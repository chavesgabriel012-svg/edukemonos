-- Consola del equipo Eduka, tarea 3 (docs/superpowers/specs/2026-11-19-consola-admin-design.md,
-- «Aprobación del colegio», «Presupuesto de IA» y «La consola»):
--   * El equipo Eduka crea colegios y marca lo que contrató cada uno (queda «pendiente»).
--   * La coordinación del colegio aprueba, retira y oculta temas; ve los temas nuevos.
--   * Cada persona recibe su catálogo (lo que su colegio ofrece y ocultó).
--   * Cifras agregadas por colegio para la consola, sin nombres ni ids de estudiantes.
-- Las tablas no tienen escritura directa: todo pasa por estas funciones.
-- Costa Rica es UTC−6 sin horario de verano: el mes y la semana (lunes a domingo) son los de allá.

-- ---------------------------------------------------------------------------
-- Ayudas internas
-- ---------------------------------------------------------------------------
create function private.audit(p_institution uuid, p_action text, p_detail jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, institution_id, action, detail)
  values ((select auth.uid()), p_institution, p_action, coalesce(p_detail, '{}'::jsonb))
$$;

-- Primer instante del mes calendario de Costa Rica que contiene a p_ts.
create function private.month_start_instant(p_ts timestamptz)
returns timestamptz
language sql immutable set search_path = ''
as $$
  select (date_trunc('month', (p_ts at time zone 'UTC') - interval '6 hours') + interval '6 hours') at time zone 'UTC'
$$;

-- Estudiantes de un colegio: los de sus grupos o secciones cuyo colegio más reciente es este.
create function private.institution_students(p_institution uuid)
returns table (student_id uuid)
language sql stable security definer set search_path = ''
as $$
  select c.student_id
  from (
    select gm.student_id from public.group_members gm
    join public.groups g on g.id = gm.group_id where g.institution_id = p_institution
    union
    select sm.student_id from public.section_members sm
    join public.sections s on s.id = sm.section_id
    left join public.groups g on g.id = s.group_id
    where coalesce(s.institution_id, g.institution_id) = p_institution
  ) c
  where private.student_institution(c.student_id) = p_institution
$$;

-- ---------------------------------------------------------------------------
-- Equipo Eduka: colegios y oferta
-- ---------------------------------------------------------------------------
create function public.admin_upsert_institution(p_id uuid, p_name text, p_slug text, p_status text, p_budget numeric)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inst uuid;
begin
  if not private.is_admin() then
    raise exception 'platform admins only' using errcode = '42501';
  end if;
  if p_id is null then
    insert into public.institutions (name, slug, status, ai_monthly_budget_usd)
    values (btrim(p_name), nullif(btrim(p_slug), ''), coalesce(p_status, 'preparando'), p_budget)
    returning id into inst;
    perform private.audit(inst, 'create_institution', jsonb_build_object('name', btrim(p_name), 'status', coalesce(p_status, 'preparando'), 'budget', p_budget));
  else
    update public.institutions
    set name = btrim(p_name), slug = nullif(btrim(p_slug), ''),
        status = coalesce(p_status, status), ai_monthly_budget_usd = p_budget
    where id = p_id
    returning id into inst;
    if inst is null then
      raise exception 'institution not found' using errcode = 'P0002';
    end if;
    perform private.audit(inst, 'update_institution', jsonb_build_object('name', btrim(p_name), 'status', p_status, 'budget', p_budget));
  end if;
  return inst;
end;
$$;

create function public.admin_set_offering(p_institution uuid, p_grade smallint, p_subject text, p_offered boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cur text;
begin
  if not private.is_admin() then
    raise exception 'platform admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.institutions where id = p_institution) then
    raise exception 'institution not found' using errcode = 'P0002';
  end if;
  select status into cur from public.institution_offerings
  where institution_id = p_institution and grade_id = p_grade and subject_id = p_subject;

  if p_offered then
    if not exists (
      select 1 from public.curriculum_units u
      join public.curriculum_sources s on s.id = u.source_id
      where u.grade_id = p_grade and u.subject_id = p_subject and u.status = 'published'
        and (s.institution_id is null or s.institution_id = p_institution)
    ) then
      raise exception 'no published content' using errcode = 'P0001';
    end if;
    if cur is null then
      insert into public.institution_offerings (institution_id, grade_id, subject_id)
      values (p_institution, p_grade, p_subject);
    elsif cur = 'retirado' then
      update public.institution_offerings set status = 'pendiente'
      where institution_id = p_institution and grade_id = p_grade and subject_id = p_subject;
    else
      return;   -- ya estaba pendiente o aprobado
    end if;
    perform private.audit(p_institution, 'offer', jsonb_build_object('grade', p_grade, 'subject', p_subject));
  else
    if cur = 'aprobado' then
      raise exception 'approved offerings are withdrawn by the school' using errcode = 'P0001';
    end if;
    if cur = 'retirado' then
      raise exception 'withdrawn offerings stay on record' using errcode = 'P0001';
    end if;
    if cur is null then
      return;
    end if;
    delete from public.institution_offerings
    where institution_id = p_institution and grade_id = p_grade and subject_id = p_subject;
    perform private.audit(p_institution, 'unoffer', jsonb_build_object('grade', p_grade, 'subject', p_subject, 'was', cur));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- El programa del colegio (coordinación o equipo Eduka)
-- ---------------------------------------------------------------------------
create function public.institution_program(p_institution uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (private.is_school_coordinator(p_institution) or private.is_admin()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'grade_id', o.grade_id,
        'subject_id', o.subject_id,
        'subject_name', sub.name,
        'status', o.status,
        'approved_at', o.approved_at,
        'units', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', u.id,
              'title', u.title,
              'sort_order', u.sort_order,
              'source_page', u.source_page,
              'published_at', u.published_at,
              'hidden', h.unit_id is not null,
              'is_new', o.status = 'aprobado' and u.published_at is not null
                        and u.published_at > coalesce(o.seen_through, o.approved_at)
            ) order by u.sort_order, u.title
          )
          from public.curriculum_units u
          join public.curriculum_sources s on s.id = u.source_id
          left join public.institution_hidden_units h
            on h.institution_id = o.institution_id and h.unit_id = u.id
          where u.grade_id = o.grade_id and u.subject_id = o.subject_id and u.status = 'published'
            and (s.institution_id is null or s.institution_id = o.institution_id)
        ), '[]'::jsonb)
      ) order by o.grade_id, sub.sort
    )
    from public.institution_offerings o
    join public.subjects sub on sub.id = o.subject_id
    where o.institution_id = p_institution
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Coordinación del colegio
-- ---------------------------------------------------------------------------
create function public.approve_offering(p_institution uuid, p_grade smallint, p_subject text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cur text;
begin
  if not private.is_school_coordinator(p_institution) then
    raise exception 'school coordination only' using errcode = '42501';
  end if;
  select status into cur from public.institution_offerings
  where institution_id = p_institution and grade_id = p_grade and subject_id = p_subject;
  if cur is null then
    raise exception 'offering not found' using errcode = 'P0002';
  end if;
  if cur = 'aprobado' then
    return;
  end if;
  update public.institution_offerings
  set status = 'aprobado', approved_by = (select auth.uid()), approved_at = now(), seen_through = now()
  where institution_id = p_institution and grade_id = p_grade and subject_id = p_subject;
  perform private.audit(p_institution, 'approve_offering', jsonb_build_object('grade', p_grade, 'subject', p_subject));
end;
$$;

create function public.withdraw_offering(p_institution uuid, p_grade smallint, p_subject text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_school_coordinator(p_institution) then
    raise exception 'school coordination only' using errcode = '42501';
  end if;
  update public.institution_offerings set status = 'retirado'
  where institution_id = p_institution and grade_id = p_grade and subject_id = p_subject
    and status <> 'retirado';
  if found then
    perform private.audit(p_institution, 'withdraw_offering', jsonb_build_object('grade', p_grade, 'subject', p_subject));
  end if;
end;
$$;

create function public.set_unit_hidden(p_institution uuid, p_unit uuid, p_hidden boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_school_coordinator(p_institution) then
    raise exception 'school coordination only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.curriculum_units where id = p_unit) then
    raise exception 'unit not found' using errcode = 'P0002';
  end if;
  if p_hidden then
    insert into public.institution_hidden_units (institution_id, unit_id, hidden_by)
    values (p_institution, p_unit, (select auth.uid()))
    on conflict (institution_id, unit_id) do nothing;
  else
    delete from public.institution_hidden_units where institution_id = p_institution and unit_id = p_unit;
  end if;
  perform private.audit(p_institution, case when p_hidden then 'hide_unit' else 'show_unit' end, jsonb_build_object('unit', p_unit));
end;
$$;

create function public.mark_units_seen(p_institution uuid, p_grade smallint, p_subject text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_school_coordinator(p_institution) then
    raise exception 'school coordination only' using errcode = '42501';
  end if;
  update public.institution_offerings set seen_through = now()
  where institution_id = p_institution and grade_id = p_grade and subject_id = p_subject;
  perform private.audit(p_institution, 'mark_units_seen', jsonb_build_object('grade', p_grade, 'subject', p_subject));
end;
$$;

-- ---------------------------------------------------------------------------
-- Catálogo de quien llama
-- ---------------------------------------------------------------------------
-- Estudiante: solo lo aprobado de su colegio. Docente o coordinación: también lo pendiente, para
-- recorrer los temas antes de aprobarlos. Sin colegio: vacío.
create function public.my_catalog()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inst uuid;
  is_student boolean;
  inst_status text;
begin
  if uid is null then
    return jsonb_build_object('institution_id', null, 'status', null, 'offerings', '[]'::jsonb, 'hidden_unit_ids', '[]'::jsonb);
  end if;
  is_student := private.student_institution(uid) is not null;
  inst := private.person_institution(uid);
  if inst is null then
    return jsonb_build_object('institution_id', null, 'status', null, 'offerings', '[]'::jsonb, 'hidden_unit_ids', '[]'::jsonb);
  end if;
  select status into inst_status from public.institutions where id = inst;
  return jsonb_build_object(
    'institution_id', inst,
    'status', inst_status,
    'offerings', coalesce((
      select jsonb_agg(jsonb_build_object('grade_id', o.grade_id, 'subject_id', o.subject_id) order by o.grade_id, o.subject_id)
      from public.institution_offerings o
      where o.institution_id = inst
        and (o.status = 'aprobado' or (not is_student and o.status = 'pendiente'))
    ), '[]'::jsonb),
    'hidden_unit_ids', coalesce((
      select jsonb_agg(h.unit_id order by h.unit_id)
      from public.institution_hidden_units h where h.institution_id = inst
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Cifras para la consola (equipo Eduka)
-- ---------------------------------------------------------------------------
create function public.admin_institutions_overview()
returns table (id uuid, name text, status text, teachers_invited int, teachers_active int, students int, spend_month numeric, budget numeric)
language plpgsql stable security definer set search_path = ''
as $$
declare
  month_start timestamptz := private.month_start_instant(now());
begin
  if not private.is_admin() then
    raise exception 'platform admins only' using errcode = '42501';
  end if;
  return query
  select i.id, i.name, i.status,
    (select count(*)::int from public.institution_invites v
      where v.institution_id = i.id and v.role = 'teacher' and v.revoked_at is null),
    (select count(*)::int from public.institution_members m
      where m.institution_id = i.id and m.role = 'teacher'),
    (select count(*)::int from private.institution_students(i.id)),
    coalesce((select sum(u.cost_usd_estimate) from public.ai_usage u
      where u.institution_id = i.id and u.created_at >= month_start), 0)::numeric,
    i.ai_monthly_budget_usd
  from public.institutions i
  order by i.name;
end;
$$;

-- Ocho semanas (la actual y las siete anteriores), solo conteos.
create function public.admin_institution_usage(p_institution uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  cur_week date := private.week_start_cr(now());
  month_start timestamptz := private.month_start_instant(now());
  weeks jsonb;
  spend numeric;
  bud numeric;
begin
  if not private.is_admin() then
    raise exception 'platform admins only' using errcode = '42501';
  end if;
  select ai_monthly_budget_usd into bud from public.institutions where id = p_institution;

  select jsonb_agg(
    jsonb_build_object(
      'week_start', w.d,
      'active_students', (
        select count(distinct a.student_id) from public.attempts a
        where a.student_id in (select student_id from private.institution_students(p_institution))
          and a.created_at >= private.week_start_instant(w.d) and a.created_at < private.week_start_instant(w.d + 7)),
      'attempts', (
        select count(*) from public.attempts a
        where a.student_id in (select student_id from private.institution_students(p_institution))
          and a.created_at >= private.week_start_instant(w.d) and a.created_at < private.week_start_instant(w.d + 7)),
      'skills_mastered', (
        select count(*) from public.mastery_weekly mw
        where mw.student_id in (select student_id from private.institution_students(p_institution))
          and mw.week_start = w.d and mw.score_start < 0.7 and mw.score_end >= 0.7),
      -- Desde ai_usage (atribuido al colegio y sin purga de 30 días), no desde tutor_messages.
      'tutor_messages', (
        select count(*) from public.ai_usage au
        where au.institution_id = p_institution and au.purpose = 'tutor' and au.success
          and au.created_at >= private.week_start_instant(w.d) and au.created_at < private.week_start_instant(w.d + 7))
    ) order by w.d
  ) into weeks
  from (select (cur_week - 7 * g)::date as d from generate_series(0, 7) g) w;

  select coalesce(sum(u.cost_usd_estimate), 0) into spend from public.ai_usage u
  where u.institution_id = p_institution and u.created_at >= month_start;

  return jsonb_build_object('weeks', weeks, 'spend_month', spend, 'budget', bud);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
revoke all on function public.admin_upsert_institution(uuid, text, text, text, numeric) from public, anon;
revoke all on function public.admin_set_offering(uuid, smallint, text, boolean) from public, anon;
revoke all on function public.institution_program(uuid) from public, anon;
revoke all on function public.approve_offering(uuid, smallint, text) from public, anon;
revoke all on function public.withdraw_offering(uuid, smallint, text) from public, anon;
revoke all on function public.set_unit_hidden(uuid, uuid, boolean) from public, anon;
revoke all on function public.mark_units_seen(uuid, smallint, text) from public, anon;
revoke all on function public.my_catalog() from public, anon;
revoke all on function public.admin_institutions_overview() from public, anon;
revoke all on function public.admin_institution_usage(uuid) from public, anon;
revoke all on function private.audit(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.month_start_instant(timestamptz) from public, anon, authenticated;
revoke all on function private.institution_students(uuid) from public, anon, authenticated;

grant execute on function public.admin_upsert_institution(uuid, text, text, text, numeric) to authenticated;
grant execute on function public.admin_set_offering(uuid, smallint, text, boolean) to authenticated;
grant execute on function public.institution_program(uuid) to authenticated;
grant execute on function public.approve_offering(uuid, smallint, text) to authenticated;
grant execute on function public.withdraw_offering(uuid, smallint, text) to authenticated;
grant execute on function public.set_unit_hidden(uuid, uuid, boolean) to authenticated;
grant execute on function public.mark_units_seen(uuid, smallint, text) to authenticated;
grant execute on function public.my_catalog() to authenticated;
grant execute on function public.admin_institutions_overview() to authenticated;
grant execute on function public.admin_institution_usage(uuid) to authenticated;
