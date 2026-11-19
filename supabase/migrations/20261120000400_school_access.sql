-- Consola del equipo Eduka, tarea 5 (docs/superpowers/specs/2026-11-19-consola-admin-design.md):
-- Eduka es solo B2B. Una sección solo existe dentro de un grupo de un colegio, con un docente de ese
-- colegio y una materia que el colegio aprobó; un grupo solo lo crea la coordinación (o el equipo
-- Eduka); y un código solo recibe estudiantes mientras el colegio está activo. Los grupos y secciones
-- sin colegio que ya existan se quedan, pero sus códigos dejan de aceptar estudiantes.

-- ---------------------------------------------------------------------------
-- Secciones: grupo del colegio, docente del colegio, oferta aprobada (al insertar y al cambiar grupo, materia o colegio)
-- ---------------------------------------------------------------------------
create or replace function private.sections_group_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if new.group_id is null then
    -- A legacy school-less section stays as it is, but cannot be attached to a school by an update.
    if tg_op = 'INSERT' or (new.institution_id is not null and new.institution_id is distinct from old.institution_id) then
      raise exception 'sections need a school group' using errcode = '23514';
    end if;
    return new;
  end if;
  select * into g from public.groups where id = new.group_id;
  if not found then
    raise exception 'group not found' using errcode = 'P0002';
  end if;
  if (tg_op = 'INSERT' or new.group_id is distinct from old.group_id)
     and (select auth.uid()) is not null and not private.can_teach_in_group(new.group_id) then
    raise exception 'you cannot add sections to this group' using errcode = '42501';
  end if;
  -- On update the rules run only when the group, subject or school actually change, so renames,
  -- teacher reassignments and edits to sections of retired subjects keep working.
  if tg_op = 'INSERT' or new.group_id is distinct from old.group_id
     or new.subject_id is distinct from old.subject_id
     or new.institution_id is distinct from old.institution_id then
    if g.institution_id is null then
      raise exception 'groups belong to a school' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.institution_members m
      where m.institution_id = g.institution_id and m.profile_id = new.teacher_id
    ) then
      raise exception 'the teacher must belong to the school' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.institution_offerings o
      where o.institution_id = g.institution_id and o.grade_id = g.grade_id
        and o.subject_id = new.subject_id and o.status = 'aprobado'
    ) then
      raise exception 'subject not approved for this school' using errcode = '23514';
    end if;
  end if;
  new.grade_id := g.grade_id;
  new.institution_id := g.institution_id;
  return new;
end;
$$;

-- El disparador también debe verse cuando cambia institution_id.
drop trigger sections_group_check on public.sections;
create trigger sections_group_check
  before insert or update of group_id, grade_id, subject_id, institution_id on public.sections
  for each row execute function private.sections_group_check();

-- ---------------------------------------------------------------------------
-- Grupos: solo dentro de un colegio, y solo la coordinación o el equipo Eduka
-- ---------------------------------------------------------------------------
create or replace function public.create_group(p_name text, p_grade smallint, p_institution uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null or not private.is_staff() then
    raise exception 'only teachers create groups' using errcode = '42501';
  end if;
  if p_institution is null
     or not (private.is_admin() or private.is_school_coordinator(p_institution)) then
    raise exception 'groups belong to a school' using errcode = '42501';
  end if;
  if p_grade not in (7, 8, 9) then
    raise exception 'invalid grade' using errcode = '22023';
  end if;
  insert into public.groups (name, grade_id, institution_id, created_by, join_code)
  values (btrim(p_name), p_grade, p_institution, uid, private.generate_join_code())
  returning id into gid;
  return gid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Códigos: solo con el colegio activo
-- ---------------------------------------------------------------------------
create or replace function public.join_with_code(p_code text, p_display_name text, p_consent boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text := upper(replace(btrim(coalesce(p_code, '')), '-', ''));
  clean_name text := btrim(p_display_name);
  g public.groups;
  sec public.sections;
  school uuid;
  school_status text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if private.is_staff() then
    raise exception 'staff accounts cannot join sections as students' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'consent required' using errcode = '22023';
  end if;
  if clean_name is null or char_length(clean_name) not between 1 and 60 then
    raise exception 'invalid display name' using errcode = '22023';
  end if;

  select * into g from public.groups where join_code = code and active;
  if not found then
    select * into sec from public.sections where join_code = code and active;
    if not found then
      raise exception 'invalid or inactive code' using errcode = 'P0002';
    end if;
    if sec.group_id is not null then
      select * into g from public.groups where id = sec.group_id and active;
      if not found then
        raise exception 'invalid or inactive code' using errcode = 'P0002';
      end if;
    end if;
  end if;

  -- No student outside a school: the code only works while the school it belongs to is active.
  school := case when g.id is not null then g.institution_id else sec.institution_id end;
  select i.status into school_status from public.institutions i where i.id = school;
  if school is null or school_status is distinct from 'activo' then
    raise exception 'school not accepting students' using errcode = 'P0001';
  end if;

  if g.id is not null then
    insert into public.students (id, declared_grade_id) values (uid, g.grade_id) on conflict (id) do nothing;
    insert into public.group_members (group_id, student_id, display_name, consent_at)
    values (g.id, uid, clean_name, now())
    on conflict on constraint group_members_pkey do update set display_name = excluded.display_name, consent_at = excluded.consent_at;
    insert into public.section_members (section_id, student_id, display_name, consent_at)
    select s.id, uid, clean_name, now() from public.sections s where s.group_id = g.id
    on conflict on constraint section_members_pkey do update set display_name = excluded.display_name, consent_at = excluded.consent_at;
    insert into public.events (actor_id, name, props) values (uid, 'group_joined', jsonb_build_object('group', g.id));
    return jsonb_build_object(
      'kind', 'group', 'id', g.id, 'name', g.name, 'grade_id', g.grade_id,
      'subjects', coalesce((select jsonb_agg(sub.name order by sub.sort) from public.sections s join public.subjects sub on sub.id = s.subject_id where s.group_id = g.id), '[]')
    );
  end if;

  insert into public.students (id, declared_grade_id) values (uid, sec.grade_id) on conflict (id) do nothing;
  insert into public.section_members (section_id, student_id, display_name, consent_at)
  values (sec.id, uid, clean_name, now())
  on conflict on constraint section_members_pkey do update set display_name = excluded.display_name, consent_at = excluded.consent_at;
  return jsonb_build_object('kind', 'section', 'id', sec.id, 'name', sec.name, 'grade_id', sec.grade_id, 'subjects', '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- join_section (RPC heredada) entraba a una sección sin mirar el colegio ni su estado: ya no se llama
-- (la web usa join_with_code), así que se cierra para no dejar una puerta lateral.
-- ---------------------------------------------------------------------------
revoke execute on function public.join_section(text, text, boolean) from public, anon, authenticated;
