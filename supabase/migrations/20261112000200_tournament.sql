-- Fase 4 (docs/producto/gamificacion.md §7): the Friday tournament of each section.
-- Requires 20261112000100_tournament_enum.sql applied first.
--
-- No cron: the first visit to the section on Friday (student or teacher) calls
-- private.ensure_tournament(), which is idempotent. It opens on Friday at 00:00 and closes on
-- Sunday at 23:59, Costa Rica time.
--   tournaments          one per section and week, with its topics (skills)
--   tournament_teams     3 to 5 members each, named from the safe list («Equipo Ceiba»)
--   tournament_members   who is in which team and the questions they got
-- Nobody reads these tables directly: students and teachers get what they may see through
-- section_tournament() and section_tournament_report(), which never give students names or ids.
-- The same rules are in packages/curriculum/src/tournament.ts, and tests compare both.

alter table public.section_settings add column tournament_enabled boolean not null default true;

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  week_start date not null,                 -- Monday, Costa Rica time
  opens_at timestamptz not null,            -- Friday 00:00
  closes_at timestamptz not null,           -- the next Monday 00:00
  skill_ids uuid[] not null,                -- the week's topics
  created_at timestamptz not null default now(),
  unique (section_id, week_start)
);

create table public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null,
  sort_order smallint not null,
  unique (tournament_id, name)
);

create table public.tournament_members (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team_id uuid not null references public.tournament_teams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  item_ids uuid[],                          -- the questions they got, chosen on their first play
  late boolean not null default false,      -- joined after the teams were made
  joined_at timestamptz not null default now(),
  primary key (tournament_id, student_id)
);
create index tournament_members_team_idx on public.tournament_members (team_id);
create index tournament_members_student_idx on public.tournament_members (student_id);

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_members enable row level security;
revoke all on public.tournaments, public.tournament_teams, public.tournament_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rules (same constants as tournament.ts)
-- ---------------------------------------------------------------------------
create function private.tournament_opens_at(p_week date)
returns timestamptz language sql immutable set search_path = ''
as $$ select private.week_start_instant(p_week + 4) $$;

create function private.tournament_closes_at(p_week date)
returns timestamptz language sql immutable set search_path = ''
as $$ select private.week_start_instant(p_week + 7) $$;

create function private.tournament_enabled(p_section uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select tournament_enabled from public.section_settings where section_id = p_section), true) $$;

-- Questions a tournament can use: verified, published, with options, in the topics.
create function private.tournament_pool(p_skills uuid[])
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select i.id from public.items i
  where i.status = 'published' and i.verified and i.kind::text in ('single_choice', 'game_fill')
    and i.skill_ids && p_skills and private.unit_is_published(i.unit_id)
$$;

-- Points of each member: right answers to their tournament questions (at most 10) plus one per
-- 0.05 of mastery gained in the topics that week (memberPoints() in tournament.ts).
create function private.tournament_member_scores(p_tournament uuid)
returns table (student_id uuid, team_id uuid, answered integer, correct integer, improvement numeric, points integer)
language sql stable security definer set search_path = ''
as $$
  select m.student_id, m.team_id, c.answered, c.correct, coalesce(w.v, 0),
         least(c.correct, 10) + floor(round(greatest(coalesce(w.v, 0), 0) * 10000) / 500)::integer
  from public.tournament_members m
  join public.tournaments t on t.id = m.tournament_id
  cross join lateral (
    select count(distinct a.item_id)::integer as answered,
           count(distinct a.item_id) filter (where a.is_correct)::integer as correct
    from public.attempts a
    where a.session_id = t.id and a.student_id = m.student_id and a.context = 'tournament'
  ) c
  left join lateral (
    select sum(x.score_end - x.score_start) as v from public.mastery_weekly x
    where x.student_id = m.student_id and x.week_start = t.week_start and x.skill_id = any (t.skill_ids)
  ) w on true
  where m.tournament_id = p_tournament
$$;

-- A team scores the mean of its members' points, one decimal (teamScore()).
create function private.tournament_team_scores(p_tournament uuid)
returns table (team_id uuid, name text, sort_order smallint, members integer, score numeric)
language sql stable security definer set search_path = ''
as $$
  select tt.id, tt.name, tt.sort_order, count(s.student_id)::integer, coalesce(round(avg(s.points), 1), 0)
  from public.tournament_teams tt
  left join private.tournament_member_scores(p_tournament) s on s.team_id = tt.id
  where tt.tournament_id = p_tournament
  group by tt.id
$$;

-- ---------------------------------------------------------------------------
-- Building the tournament: once per section and week, on the first visit from Friday on
-- ---------------------------------------------------------------------------
create function private.ensure_tournament(p_section uuid, p_now timestamptz)
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

  -- Topics: the skills of the section most of its students worked this week (pickTopics()).
  select array_agg(skill_id order by n desc, a desc, skill_id::text collate "C") into topics
  from (
    select w.skill_id, count(distinct w.student_id) as n, sum(w.attempts) as a
    from public.mastery_weekly w
    join public.section_members m on m.student_id = w.student_id and m.section_id = p_section
    where w.week_start = wk and w.attempts > 0 and w.skill_id in (select private.section_scope_skills(p_section))
    group by w.skill_id
    order by n desc, a desc, w.skill_id::text collate "C"
    limit 8
  ) x;
  if topics is null or not exists (select 1 from private.tournament_pool(topics)) then
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

-- This week's tournament of the section, or else the most recent one, with its status.
create function private.tournament_pick(p_section uuid, p_now timestamptz)
returns table (tournament_id uuid, status text)
language plpgsql security definer set search_path = ''
as $$
declare
  wk date := private.week_start_cr(p_now);
  t public.tournaments;
begin
  perform private.ensure_tournament(p_section, p_now);
  select * into t from public.tournaments x where x.section_id = p_section and x.week_start <= wk order by x.week_start desc limit 1;
  if not found then
    tournament_id := null;
  else
    tournament_id := t.id;
  end if;
  status := case
    when t.id is not null and t.week_start = wk and p_now >= t.opens_at and p_now < t.closes_at then 'open'
    when p_now < private.tournament_opens_at(wk) then 'upcoming'
    when t.id is not null and t.week_start = wk then 'closed'
    else 'none'   -- this week, from Friday on, without a tournament: little activity, few students or a break
  end;
  return next;
end;
$$;

-- Topic names of a tournament, in its order.
create function private.tournament_topics(p_tournament uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(k.name order by t.ord), '[]'::jsonb)
  from public.tournaments x, unnest(x.skill_ids) with ordinality t(id, ord) join public.skills k on k.id = t.id
  where x.id = p_tournament
$$;

-- ---------------------------------------------------------------------------
-- What a student sees: their team, its score, their points and the teams above the last one.
-- Never names, ids or the members of other teams.
-- ---------------------------------------------------------------------------
create function private.tournament_student_view(p_tournament uuid, p_student uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with teams as (select * from private.tournament_team_scores(p_tournament)),
  mine as (select m.team_id from public.tournament_members m where m.tournament_id = p_tournament and m.student_id = p_student),
  low as (select min(score) as s from teams)
  select jsonb_build_object(
    'id', p_tournament,
    'week_start', x.week_start,
    'opens_at', x.opens_at,
    'closes_at', x.closes_at,
    'topics', private.tournament_topics(p_tournament),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'score', t.score, 'me', t.team_id = (select team_id from mine)) order by t.score desc, t.name)
      from teams t
      where t.team_id = (select team_id from mine) or t.score > (select s from low)
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
        'team', t.name, 'team_size', t.members, 'team_score', t.score,
        'answered', s.answered, 'correct', s.correct, 'counted', least(s.correct, 10),
        'improvement_points', s.points - least(s.correct, 10), 'points', s.points,
        'questions', coalesce(cardinality(m.item_ids), 0),
        'started', m.item_ids is not null)
      from public.tournament_members m
      join teams t on t.team_id = m.team_id
      join private.tournament_member_scores(p_tournament) s on s.student_id = m.student_id
      where m.tournament_id = p_tournament and m.student_id = p_student
    )
  )
  from public.tournaments x where x.id = p_tournament
$$;

create function private.section_tournament_at(p_section uuid, p_now timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  wk date := private.week_start_cr(p_now);
  pick record;
begin
  if not private.is_section_member(p_section) then
    raise exception 'not your section' using errcode = '42501';
  end if;
  if not private.tournament_enabled(p_section) then
    return jsonb_build_object('enabled', false);
  end if;
  select * into pick from private.tournament_pick(p_section, p_now);
  return jsonb_build_object(
    'enabled', true,
    'status', pick.status,
    'opens_at', private.tournament_opens_at(wk),
    'closes_at', private.tournament_closes_at(wk),
    'tournament', case when pick.tournament_id is null then null else private.tournament_student_view(pick.tournament_id, uid) end
  );
end;
$$;

create function public.section_tournament(p_section uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select private.section_tournament_at(p_section, now()) $$;

-- ---------------------------------------------------------------------------
-- Playing: join (a late student goes to the smallest team), get the questions, answer them
-- with submit_attempt(context 'tournament', session = tournament).
-- ---------------------------------------------------------------------------
create function public.tournament_questions(p_tournament uuid)
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
      join public.items i on i.id = q.id
      where not exists (select 1 from public.attempts a where a.session_id = t.id and a.item_id = i.id and a.student_id = uid)
    ), '[]'::jsonb)
  );
end;
$$;

-- submit_attempt(): the games version, plus tournament answers (only the student's own
-- questions, once each, while the tournament is open).
create or replace function public.submit_attempt(
  p_item_id uuid,
  p_answer_index smallint,
  p_answer_text text default null,
  p_time_ms integer default null,
  p_hints_used smallint default 0,
  p_session_id uuid default null,
  p_context public.attempt_context default 'practice',
  p_diagnostic_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  it public.items;
  correct boolean;
  given jsonb;
  skill uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select i.* into it from public.items i
  where i.id = p_item_id
    and i.status = 'published'
    and private.unit_is_published(i.unit_id);
  if not found then
    raise exception 'item not available' using errcode = 'P0002';
  end if;

  if p_context = 'diagnostic' then
    if not it.verified or it.kind <> 'single_choice' then
      raise exception 'unverified items cannot be used in diagnostics' using errcode = '22023';
    end if;
    if p_diagnostic_id is null or not exists (
      select 1 from public.diagnostics d
      where d.id = p_diagnostic_id and d.student_id = uid and d.status = 'in_progress'
    ) then
      raise exception 'invalid diagnostic' using errcode = '22023';
    end if;
    if exists (select 1 from public.attempts a where a.diagnostic_id = p_diagnostic_id and a.item_id = it.id) then
      raise exception 'item already answered in this diagnostic' using errcode = '22023';
    end if;
  end if;

  -- A game answer belongs to an open run of the student that contains the piece, once.
  if p_context = 'game' then
    if p_session_id is null or not exists (
      select 1 from public.game_runs r
      where r.id = p_session_id and r.student_id = uid and r.finished_at is null and it.id = any (r.item_ids)
    ) then
      raise exception 'invalid game run' using errcode = '22023';
    end if;
    if exists (select 1 from public.attempts a where a.session_id = p_session_id and a.item_id = it.id and a.student_id = uid) then
      raise exception 'piece already answered in this game' using errcode = '22023';
    end if;
  end if;

  -- A tournament answer: one of the student's questions, once, while the tournament is open.
  if p_context = 'tournament' then
    if p_session_id is null or not exists (
      select 1 from public.tournament_members m
      join public.tournaments t on t.id = m.tournament_id
      where t.id = p_session_id and m.student_id = uid and it.id = any (m.item_ids)
        and now() >= t.opens_at and now() < t.closes_at
    ) then
      raise exception 'invalid tournament' using errcode = '22023';
    end if;
    if exists (select 1 from public.attempts a where a.session_id = p_session_id and a.item_id = it.id and a.student_id = uid) then
      raise exception 'question already answered in this tournament' using errcode = '22023';
    end if;
  end if;

  insert into public.students (id) values (uid) on conflict (id) do nothing;

  if it.kind = 'single_choice' then
    correct := p_answer_index is not null and p_answer_index = it.correct_index;
  elsif it.kind in ('game_fill', 'game_find_error') then
    correct := p_answer_index is not null and p_answer_index = (it.game_answer ->> 'index')::smallint;
  elsif it.kind in ('game_pairs', 'game_order') then
    begin
      given := p_answer_text::jsonb;
    exception when others then
      given := null;
    end;
    correct := given is not null
      and given = (case when it.kind = 'game_pairs' then it.game_answer -> 'match' else it.game_answer -> 'order' end);
  else
    correct := null;  -- open writing is assessed by the tutor/feedback flow
  end if;

  insert into public.attempts (
    student_id, item_id, context, diagnostic_id, answer_index, answer_text,
    is_correct, time_ms, hints_used, session_id
  ) values (
    uid, it.id, p_context, p_diagnostic_id, p_answer_index, p_answer_text,
    correct, p_time_ms, coalesce(p_hints_used, 0), p_session_id
  );

  if correct is not null then
    foreach skill in array it.skill_ids loop
      insert into public.mastery as m (student_id, skill_id, score, attempts, updated_at)
      values (uid, skill, private.mastery_after(null::numeric, 0, it.difficulty::integer, correct), 1, now())
      on conflict (student_id, skill_id) do update
        set score = private.mastery_after(m.score, m.attempts, it.difficulty::integer, correct),
            attempts = m.attempts + 1,
            updated_at = now();
    end loop;
  end if;

  return jsonb_build_object(
    'is_correct', correct,
    'correct_index', it.correct_index,
    'explanation', it.explanation,
    'distractor_explanations', to_jsonb(it.distractor_explanations),
    -- After answering, the student may see the right answer of a game piece.
    'game_answer', it.game_answer
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- What the teacher sees: every team with its score, and what each student added to their
-- mastery in the topics (not to the competition). Only the section's teacher.
-- ---------------------------------------------------------------------------
create function private.section_tournament_report_at(p_section uuid, p_now timestamptz)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  wk date := private.week_start_cr(p_now);
  pick record;
  x public.tournaments;
begin
  if not private.owns_section(p_section) then
    raise exception 'not your section' using errcode = '42501';
  end if;
  if not private.tournament_enabled(p_section) then
    return jsonb_build_object('enabled', false);
  end if;
  select * into pick from private.tournament_pick(p_section, p_now);
  select * into x from public.tournaments where id = pick.tournament_id;
  return jsonb_build_object(
    'enabled', true,
    'status', pick.status,
    'opens_at', private.tournament_opens_at(wk),
    'closes_at', private.tournament_closes_at(wk),
    'tournament', case when x.id is null then null else jsonb_build_object(
      'id', x.id,
      'week_start', x.week_start,
      'opens_at', x.opens_at,
      'closes_at', x.closes_at,
      'topics', private.tournament_topics(x.id),
      'teams', coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', t.name,
          'score', t.score,
          'members', coalesce((
            select jsonb_agg(jsonb_build_object(
              'student_id', s.student_id,
              'name', sm.display_name,
              'improvement', round(s.improvement * 100)::integer,
              'played', s.answered > 0,
              'late', tm.late) order by sm.display_name)
            from private.tournament_member_scores(x.id) s
            join public.tournament_members tm on tm.tournament_id = x.id and tm.student_id = s.student_id
            join public.section_members sm on sm.section_id = p_section and sm.student_id = s.student_id
            where s.team_id = t.team_id
          ), '[]'::jsonb)) order by t.score desc, t.sort_order)
        from private.tournament_team_scores(x.id) t
      ), '[]'::jsonb)
    ) end
  );
end;
$$;

create function public.section_tournament_report(p_section uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select private.section_tournament_report_at(p_section, now()) $$;

-- ---------------------------------------------------------------------------
-- Recovery codes also move tournament memberships.
-- ---------------------------------------------------------------------------
create or replace function private.move_student_extras(p_old uuid, p_new uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  n_runs integer;
  n_tournaments integer;
begin
  update public.game_runs set student_id = p_new where student_id = p_old;
  get diagnostics n_runs = row_count;
  -- The old device's membership wins in a tournament both took part in.
  delete from public.tournament_members n
  using public.tournament_members o
  where n.student_id = p_new and o.student_id = p_old and o.tournament_id = n.tournament_id;
  update public.tournament_members set student_id = p_new where student_id = p_old;
  get diagnostics n_tournaments = row_count;
  return jsonb_build_object('game_runs', n_runs, 'tournaments', n_tournaments);
end;
$$;

revoke all on function public.section_tournament(uuid) from public, anon;
revoke all on function public.tournament_questions(uuid) from public, anon;
revoke all on function public.section_tournament_report(uuid) from public, anon;
grant execute on function public.section_tournament(uuid) to authenticated;
grant execute on function public.tournament_questions(uuid) to authenticated;
grant execute on function public.section_tournament_report(uuid) to authenticated;
