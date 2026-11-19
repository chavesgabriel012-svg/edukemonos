-- Consola del equipo Eduka, tarea 4 (docs/superpowers/specs/2026-11-19-consola-admin-design.md,
-- «Invitaciones y acceso docente»):
--   * La coordinación del colegio (o el equipo Eduka) invita desde una lista; la persona queda
--     vinculada al colegio al crear su cuenta o al entrar (claim_invites / claim_my_invites).
--   * Quitar a alguien pasa sus secciones a quien el colegio nombre (por defecto, la coordinación más
--     antigua) para no perder el avance de los estudiantes; cualquier sección puede cambiar de docente.
--   * add_institution_member deja de ser llamable: lo reemplazan las invitaciones.
-- Toda acción queda en admin_audit_log, la haga quien la haga.

-- ---------------------------------------------------------------------------
-- sections.teacher_id solo cambia desde reassign_section / remove_institution_member
-- (misma técnica que el código de acceso: una bandera local a la transacción).
-- ---------------------------------------------------------------------------
create or replace function private.sections_before_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.join_code := private.generate_join_code();
  elsif new.teacher_id <> old.teacher_id
        and coalesce(current_setting('app.allow_teacher_change', true), '') <> 'on' then
    raise exception 'teacher_id cannot change';
  elsif new.join_code <> old.join_code
        and coalesce(current_setting('app.allow_join_code_change', true), '') <> 'on' then
    raise exception 'use regenerate_join_code()';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vincular invitaciones
-- ---------------------------------------------------------------------------
-- Vincula todas las invitaciones abiertas del correo de ese perfil. Devuelve cuántas vinculó ahora.
-- El correo sale de auth.users (p_email se ignora) y solo cuenta si está confirmado: quien se registra
-- con un correo ajeno, o quien recibió la invitación y todavía no entra, no queda vinculado.
create function private.claim_invites(p_profile uuid, p_email text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  em text;
  confirmed timestamptz;
  inv record;
  n int := 0;
begin
  select lower(btrim(u.email)), u.email_confirmed_at into em, confirmed
  from auth.users u where u.id = p_profile and coalesce(u.is_anonymous, false) = false;
  if em is null or em = '' or confirmed is null
     or not exists (select 1 from public.profiles where id = p_profile) then
    return 0;
  end if;
  for inv in
    select * from public.institution_invites
    where email = em and revoked_at is null and accepted_at is null
    order by invited_at, id
  loop
    insert into public.institution_members (institution_id, profile_id, role)
    values (inv.institution_id, p_profile, inv.role)
    on conflict (institution_id, profile_id) do nothing;
    update public.institution_invites
    set accepted_profile_id = p_profile, accepted_at = now()
    where id = inv.id;
    update public.profiles set display_name = inv.display_name
    where id = p_profile and btrim(coalesce(display_name, '')) = '';
    insert into public.admin_audit_log (actor_id, institution_id, action, detail)
    values (p_profile, inv.institution_id, 'claim_invite', jsonb_build_object('invite', inv.id, 'role', inv.role));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Para quien ya tenía cuenta: el correo sale de auth.users, nunca del cliente.
create function public.claim_my_invites()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  em text;
begin
  if uid is null then
    return 0;
  end if;
  select u.email into em from auth.users u where u.id = uid and coalesce(u.is_anonymous, false) = false;
  if em is null then
    return 0;
  end if;
  return private.claim_invites(uid, em);
end;
$$;

-- Igual que antes (perfil solo para cuentas no anónimas), más la vinculación de invitaciones.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) = false then
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
    on conflict (id) do nothing;
    perform private.claim_invites(new.id, new.email);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitar y revocar
-- ---------------------------------------------------------------------------
create function public.create_invites(p_institution uuid, p_people jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  p jsonb;
  em text;
  nm text;
  rl public.institution_role;
  new_id uuid;
  created jsonb := '[]'::jsonb;
  skipped jsonb := '[]'::jsonb;
begin
  if not (private.is_admin() or private.is_school_coordinator(p_institution)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_people is null or jsonb_typeof(p_people) <> 'array' then
    raise exception 'people must be an array' using errcode = '22023';
  end if;
  if not exists (select 1 from public.institutions where id = p_institution) then
    raise exception 'institution not found' using errcode = 'P0002';
  end if;

  for p in select * from jsonb_array_elements(p_people) loop
    em := lower(btrim(coalesce(p ->> 'email', '')));
    if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'invalid email: %', em using errcode = '22023';
    end if;
    nm := left(coalesce(nullif(btrim(coalesce(p ->> 'name', '')), ''), split_part(em, '@', 1)), 120);
    rl := coalesce(nullif(btrim(coalesce(p ->> 'role', '')), ''), 'teacher')::public.institution_role;

    if exists (
      select 1 from auth.users u
      join public.institution_members m on m.profile_id = u.id and m.institution_id = p_institution
      where lower(btrim(u.email)) = em
    ) then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'already_member');
      continue;
    end if;

    insert into public.institution_invites (institution_id, email, display_name, role, invited_by)
    values (p_institution, em, nm, rl, (select auth.uid()))
    on conflict (institution_id, email) where revoked_at is null do nothing
    returning id into new_id;

    if new_id is null then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'already_invited');
    else
      created := created || jsonb_build_object('id', new_id, 'email', em);
    end if;
    new_id := null;
  end loop;

  perform private.audit(p_institution, 'create_invites',
    jsonb_build_object('created', jsonb_array_length(created), 'skipped', jsonb_array_length(skipped)));
  return jsonb_build_object('created', created, 'skipped', skipped);
end;
$$;

create function public.revoke_invite(p_invite uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.institution_invites;
begin
  select * into inv from public.institution_invites where id = p_invite;
  if inv.id is null or not (private.is_admin() or private.is_school_coordinator(inv.institution_id)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite already accepted; remove the member instead' using errcode = 'P0001';
  end if;
  if inv.revoked_at is not null then
    return;
  end if;
  update public.institution_invites set revoked_at = now() where id = p_invite;
  perform private.audit(inv.institution_id, 'revoke_invite', jsonb_build_object('invite', p_invite, 'email', inv.email));
end;
$$;

-- ---------------------------------------------------------------------------
-- Miembros
-- ---------------------------------------------------------------------------
create function public.set_member_role(p_institution uuid, p_profile uuid, p_role public.institution_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cur public.institution_role;
begin
  if not (private.is_admin() or private.is_school_coordinator(p_institution)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select role into cur from public.institution_members
  where institution_id = p_institution and profile_id = p_profile for update;
  if cur is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if cur = p_role then
    return;
  end if;
  if cur = 'admin' and not exists (
    select 1 from public.institution_members
    where institution_id = p_institution and role = 'admin' and profile_id <> p_profile
  ) then
    raise exception 'last coordinator' using errcode = 'P0001';
  end if;
  update public.institution_members set role = p_role
  where institution_id = p_institution and profile_id = p_profile;
  perform private.audit(p_institution, 'set_member_role',
    jsonb_build_object('profile', p_profile, 'from', cur, 'to', p_role));
end;
$$;

create function public.remove_institution_member(p_institution uuid, p_profile uuid, p_replacement uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cur public.institution_role;
  repl uuid := p_replacement;
  moved int;
begin
  if not (private.is_admin() or private.is_school_coordinator(p_institution)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select role into cur from public.institution_members
  where institution_id = p_institution and profile_id = p_profile for update;
  if cur is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if cur = 'admin' and not exists (
    select 1 from public.institution_members
    where institution_id = p_institution and role = 'admin' and profile_id <> p_profile
  ) then
    raise exception 'last coordinator' using errcode = 'P0001';
  end if;

  if repl is null then
    select m.profile_id into repl from public.institution_members m
    where m.institution_id = p_institution and m.role = 'admin' and m.profile_id <> p_profile
    order by m.created_at, m.profile_id limit 1;
  end if;
  if repl is null or repl = p_profile or not exists (
    select 1 from public.institution_members
    where institution_id = p_institution and profile_id = repl
  ) then
    raise exception 'replacement must be another active member of the school' using errcode = 'P0001';
  end if;

  perform set_config('app.allow_teacher_change', 'on', true);
  update public.sections s set teacher_id = repl
  where s.teacher_id = p_profile
    and coalesce(s.institution_id, (select g.institution_id from public.groups g where g.id = s.group_id)) = p_institution;
  get diagnostics moved = row_count;
  perform set_config('app.allow_teacher_change', '', true);

  update public.groups set guide_id = null where institution_id = p_institution and guide_id = p_profile;
  update public.institution_invites set revoked_at = now()
  where institution_id = p_institution and accepted_profile_id = p_profile and revoked_at is null;
  delete from public.institution_members where institution_id = p_institution and profile_id = p_profile;

  perform private.audit(p_institution, 'remove_member',
    jsonb_build_object('profile', p_profile, 'role', cur, 'replacement', repl, 'sections_moved', moved));
end;
$$;

create function public.reassign_section(p_section uuid, p_teacher uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  inst uuid;
  prev uuid;
begin
  select s.teacher_id, coalesce(s.institution_id, g.institution_id) into prev, inst
  from public.sections s left join public.groups g on g.id = s.group_id
  where s.id = p_section;
  if inst is null or not (private.is_admin() or private.is_school_coordinator(inst)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.institution_members where institution_id = inst and profile_id = p_teacher
  ) then
    raise exception 'new teacher is not a member of the school' using errcode = 'P0001';
  end if;
  if prev = p_teacher then
    return;
  end if;
  perform set_config('app.allow_teacher_change', 'on', true);
  update public.sections set teacher_id = p_teacher where id = p_section;
  perform set_config('app.allow_teacher_change', '', true);
  perform private.audit(inst, 'reassign_section',
    jsonb_build_object('section', p_section, 'from', prev, 'to', p_teacher));
end;
$$;

-- ---------------------------------------------------------------------------
-- La lista de personas del colegio
-- ---------------------------------------------------------------------------
create function public.institution_people(p_institution uuid)
returns table (kind text, profile_id uuid, invite_id uuid, name text, email text, role public.institution_role, status text, since timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (private.is_admin() or private.is_school_coordinator(p_institution)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select 'member'::text, m.profile_id, null::uuid,
         coalesce(nullif(btrim(p.display_name), ''), split_part(coalesce(u.email, ''), '@', 1)),
         u.email::text, m.role, 'activo'::text, m.created_at
  from public.institution_members m
  join public.profiles p on p.id = m.profile_id
  left join auth.users u on u.id = m.profile_id
  where m.institution_id = p_institution
  union all
  select 'invite'::text, i.accepted_profile_id, i.id, i.display_name, i.email, i.role,
         case when i.revoked_at is not null then 'revocado' else 'invitado' end, i.invited_at
  from public.institution_invites i
  where i.institution_id = p_institution
    and (i.accepted_at is null or i.revoked_at is not null)
  order by 8, 4;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
revoke all on function public.add_institution_member(uuid, text, public.institution_role) from public, anon, authenticated;
revoke all on function private.claim_invites(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_my_invites() from public, anon;
revoke all on function public.create_invites(uuid, jsonb) from public, anon;
revoke all on function public.revoke_invite(uuid) from public, anon;
revoke all on function public.set_member_role(uuid, uuid, public.institution_role) from public, anon;
revoke all on function public.remove_institution_member(uuid, uuid, uuid) from public, anon;
revoke all on function public.reassign_section(uuid, uuid) from public, anon;
revoke all on function public.institution_people(uuid) from public, anon;

grant execute on function public.claim_my_invites() to authenticated;
grant execute on function public.create_invites(uuid, jsonb) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.institution_role) to authenticated;
grant execute on function public.remove_institution_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.reassign_section(uuid, uuid) to authenticated;
grant execute on function public.institution_people(uuid) to authenticated;
