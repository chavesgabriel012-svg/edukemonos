-- Consola del equipo Eduka, parte 5: endurecimiento tras la revisión final.
--   * Quien crea un grupo lo administra solo mientras siga en el colegio del grupo. Al quitar a una
--     coordinación, deja de leer los nombres de los estudiantes y de cambiar sus grupos.
--   * El equipo Eduka no aprueba en nombre del colegio: private.is_school_coordinator() no cuenta a
--     los administradores de la plataforma aunque tengan una fila de miembro, y nadie escribe
--     institution_members por la API (solo las funciones de invitaciones y personas, que dejan
--     registro en admin_audit_log).
--   * El torneo no usa temas que el colegio ocultó.
-- Corre sola en el editor SQL de Supabase, como una transacción, después de 20261120000400.

-- ---------------------------------------------------------------------------
-- Quién administra un grupo
-- ---------------------------------------------------------------------------
-- Su creador mientras siga siendo miembro del colegio del grupo (o el grupo no tenga colegio), la
-- coordinación de su colegio o un administrador de la plataforma.
create or replace function private.manages_group(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group
      and ((g.created_by = (select auth.uid())
            and (g.institution_id is null or exists (
              select 1 from public.institution_members m
              where m.institution_id = g.institution_id and m.profile_id = g.created_by)))
           or (g.institution_id is not null and private.is_institution_admin(g.institution_id))
           or private.is_admin())
  )
$$;

-- ---------------------------------------------------------------------------
-- La aprobación es del colegio
-- ---------------------------------------------------------------------------
-- Coordinación del colegio: miembro con rol admin que no es administrador de la plataforma. Las
-- funciones que también dejan pasar al equipo Eduka (invitar, quitar, cambiar rol, reasignar) lo
-- dicen aparte con private.is_admin(); aprobar, retirar, ocultar temas y marcar los nuevos como
-- vistos no.
create or replace function private.is_school_coordinator(p_institution uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.institution_members m
    where m.institution_id = p_institution
      and m.profile_id = (select auth.uid())
      and m.role = 'admin'
  ) and not private.is_admin()
$$;

-- Las membresías cambian solo por las funciones de invitaciones y personas.
drop policy if exists institution_members_admin_write on public.institution_members;
revoke insert, update, delete on public.institution_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- El torneo no usa temas ocultos
-- ---------------------------------------------------------------------------
-- Temas que el colegio de la sección ocultó.
create function private.section_hidden_units(p_section uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select h.unit_id
  from public.sections s
  join public.institution_hidden_units h
    on h.institution_id = coalesce(s.institution_id, (select g.institution_id from public.groups g where g.id = s.group_id))
  where s.id = p_section
$$;

-- Versión de 20261112000200 con los temas ocultos fuera de la elección de temas.
create or replace function private.ensure_tournament(p_section uuid, p_now timestamptz)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  wk date := private.week_start_cr(p_now);
  t uuid;
  topics uuid[];
  players uuid[];
  k integer;
  names text[];
  team_ids uuid[] := '{}';
  team uuid;
  i integer;
begin
  select id into t from public.tournaments where section_id = p_section and week_start = wk;
  if found then
    return t;
  end if;
  if p_now < private.tournament_opens_at(wk) or p_now >= private.tournament_closes_at(wk)
     or not private.tournament_enabled(p_section) or private.week_paused_for_section(p_section, wk) then
    return null;
  end if;

  -- Topics: the skills of the section most of its students worked this week (pickTopics()), except
  -- those of units the school hid.
  select array_agg(skill_id order by n desc, a desc, skill_id::text collate "C") into topics
  from (
    select w.skill_id, count(distinct w.student_id) as n, sum(w.attempts) as a
    from public.mastery_weekly w
    join public.section_members m on m.student_id = w.student_id and m.section_id = p_section
    where w.week_start = wk and w.attempts > 0 and w.skill_id in (select private.section_scope_skills(p_section))
      and w.skill_id not in (
        select sk.id from public.skills sk where sk.unit_id in (select private.section_hidden_units(p_section)))
    group by w.skill_id
    order by n desc, a desc, w.skill_id::text collate "C"
    limit 8
  ) x;
  if topics is null or not exists (
    select 1 from private.tournament_pool(topics) p(id)
    join public.items pi on pi.id = p.id
    where pi.unit_id not in (select private.section_hidden_units(p_section))
  ) then
    return null;
  end if;

  -- Players: members with answers in the section's subject in the last 4 weeks, strongest first
  -- by their mean mastery in the topics (0.5 without data), ties by id (snakeTeams()).
  select array_agg(student_id order by level desc, student_id::text collate "C") into players
  from (
    select m.student_id,
           coalesce((select avg(ms.score) from public.mastery ms where ms.student_id = m.student_id and ms.skill_id = any (topics)), 0.5) as level
    from public.section_members m
    join public.sections s on s.id = m.section_id
    where m.section_id = p_section
      and exists (
        select 1 from public.attempts a
        where a.student_id = m.student_id and a.created_at >= p_now - interval '28 days'
          and (s.subject_id is null or a.subject_id = s.subject_id)
      )
  ) p;
  if coalesce(cardinality(players), 0) < 6 then
    return null;
  end if;
  k := ceil(cardinality(players) / 5.0)::integer;

  insert into public.tournaments (section_id, week_start, opens_at, closes_at, skill_ids)
  values (p_section, wk, private.tournament_opens_at(wk), private.tournament_closes_at(wk), topics)
  on conflict (section_id, week_start) do nothing
  returning id into t;
  if t is null then
    -- Another visit created it at the same moment.
    select id into t from public.tournaments where section_id = p_section and week_start = wk;
    return t;
  end if;

  select array_agg(n) into names from (select n from unnest(private.nickname_nouns()) n order by random() limit k) x;
  for i in 1 .. k loop
    insert into public.tournament_teams (tournament_id, name, sort_order) values (t, 'Equipo ' || names[i], i) returning id into team;
    team_ids := team_ids || team;
  end loop;

  -- Snake draft: teams 1, 2, …, k, k, …, 2, 1, 1, 2, …
  for i in 1 .. cardinality(players) loop
    insert into public.tournament_members (tournament_id, team_id, student_id)
    values (t, team_ids[case when ((i - 1) / k) % 2 = 0 then (i - 1) % k else k - 1 - (i - 1) % k end + 1], players[i]);
  end loop;
  return t;
end;
$$;

-- Versión vigente (la de 20261112000200 con el filtro de fuente de 20261120000100) con los temas
-- ocultos fuera: no se eligen preguntas de ellos, y las ya elegidas de un tema que se ocultó
-- después dejan de entregarse.
create or replace function public.tournament_questions(p_tournament uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.tournaments;
  m public.tournament_members;
  team uuid;
  picked uuid[];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into t from public.tournaments where id = p_tournament;
  if not found or not private.is_section_member(t.section_id) then
    raise exception 'not your section' using errcode = '42501';
  end if;
  if not private.tournament_enabled(t.section_id) then
    return jsonb_build_object('ok', false, 'error', 'disabled');
  end if;
  if now() < t.opens_at or now() >= t.closes_at then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  select * into m from public.tournament_members where tournament_id = t.id and student_id = uid;
  if not found then
    select tt.id into team from public.tournament_teams tt
    left join public.tournament_members x on x.team_id = tt.id
    where tt.tournament_id = t.id
    group by tt.id, tt.sort_order
    order by count(x.student_id), tt.sort_order
    limit 1;
    insert into public.tournament_members (tournament_id, team_id, student_id, late)
    values (t.id, team, uid, true)
    on conflict (tournament_id, student_id) do nothing;
    select * into m from public.tournament_members where tournament_id = t.id and student_id = uid;
  end if;

  if m.item_ids is null then
    select array_agg(id) into picked from (
      select p.id from private.tournament_pool(t.skill_ids) p(id)
      join public.items pi on pi.id = p.id
      where private.can_read_source(private.unit_source_id(pi.unit_id))
        and pi.unit_id not in (select private.section_hidden_units(t.section_id))
      order by exists (select 1 from public.attempts a where a.student_id = uid and a.item_id = p.id and a.is_correct), random()
      limit 10
    ) x;
    update public.tournament_members set item_ids = coalesce(picked, '{}') where tournament_id = t.id and student_id = uid
    returning * into m;
    insert into public.events (actor_id, name, props) values (uid, 'tournament_joined', jsonb_build_object('tournament', t.id));
  end if;

  return jsonb_build_object(
    'ok', true,
    'tournament', t.id,
    'total', cardinality(m.item_ids),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'stem', i.stem, 'options', to_jsonb(i.options),
        'game_public', i.game_public, 'reviewed', i.reviewer_id is not null) order by q.ord)
      from unnest(m.item_ids) with ordinality q(id, ord)
      join public.items i on i.id = q.id and private.can_read_source(private.unit_source_id(i.unit_id))
        and i.unit_id not in (select private.section_hidden_units(t.section_id))
      where not exists (select 1 from public.attempts a where a.session_id = t.id and a.item_id = i.id and a.student_id = uid)
    ), '[]'::jsonb)
  );
end;
$$;
