-- Fase 3 (docs/producto/gamificacion.md §6): mini-games with fixed mechanics and verified content.
-- Requires 20261106000100_game_enums.sql applied first.
--
-- A game piece is an item of kind game_pairs | game_order | game_fill | game_find_error:
--   game_public  what the browser may show (shuffled, no answer)
--   game_answer  the answer; never readable through the API, graded in submit_attempt()
-- A play is a game run: start_game_run() picks the pieces, every answer goes through
-- submit_attempt(context 'game', session = run) and updates mastery like practice, and
-- finish_game_run() closes it. The ghost race reuses the unit's verified exercises.

alter table public.items
  add column game_public jsonb,
  add column game_answer jsonb;

-- The public part is readable like the rest of a published item; the answer is not.
grant select (game_public) on public.items to anon, authenticated;

alter table public.section_settings add column games_enabled boolean not null default true;

create table public.game_runs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  unit_id uuid not null references public.curriculum_units (id) on delete cascade,
  mode text not null check (mode in ('pairs', 'order', 'fill', 'find_error', 'ghost_race')),
  item_ids uuid[] not null,
  -- Ghost race: the rival's answers, right or wrong, question by question (never who it was).
  rival jsonb,
  pattern boolean[],
  correct integer,
  total integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index game_runs_student_idx on public.game_runs (student_id, unit_id, mode, finished_at);

alter table public.game_runs enable row level security;
create policy game_runs_select_own on public.game_runs for select to authenticated
  using (student_id = (select auth.uid()));
revoke insert, update, delete on public.game_runs from anon, authenticated;

-- Games are shown unless EVERY section of the student turned them off (same rule as the streak).
create function private.games_visible(p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.section_members m where m.student_id = p_student)
      or exists (
        select 1 from public.section_members m
        left join public.section_settings ss on ss.section_id = m.section_id
        where m.student_id = p_student and coalesce(ss.games_enabled, true)
      )
$$;

create function public.games_enabled_for_me()
returns boolean
language sql stable security definer set search_path = ''
as $$ select auth.uid() is null or private.games_visible(auth.uid()) $$;

-- ---------------------------------------------------------------------------
-- submit_attempt(): also grades game pieces and checks game runs
-- ---------------------------------------------------------------------------
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
-- Game runs
-- ---------------------------------------------------------------------------
-- Starts a play: up to 3 pieces of a mechanic (first those not yet solved), or 8 questions for the
-- ghost race (verified exercises and fill pieces), plus the ghost: the student's own best race in
-- the unit or, the first time, an anonymous classmate of a similar level.
create function public.start_game_run(p_unit uuid, p_mode text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  picked uuid[];
  rival jsonb;
  run uuid;
  my_level numeric;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_mode not in ('pairs', 'order', 'fill', 'find_error', 'ghost_race') then
    raise exception 'unknown game' using errcode = '22023';
  end if;
  if not private.unit_is_published(p_unit) then
    raise exception 'unit not available' using errcode = 'P0002';
  end if;
  if not private.games_visible(uid) then
    return jsonb_build_object('ok', false, 'error', 'disabled');
  end if;

  if p_mode = 'ghost_race' then
    select array_agg(id) into picked from (
      select i.id from public.items i
      where i.unit_id = p_unit and i.status = 'published' and i.verified and i.kind::text in ('single_choice', 'game_fill')
      order by random() limit 8
    ) x;
  else
    select array_agg(id) into picked from (
      select i.id from public.items i
      where i.unit_id = p_unit and i.status = 'published' and i.verified and i.kind::text = 'game_' || p_mode
      order by exists (select 1 from public.attempts a where a.student_id = uid and a.item_id = i.id and a.is_correct), random()
      limit 3
    ) x;
  end if;
  if picked is null then
    return jsonb_build_object('ok', false, 'error', 'no_content');
  end if;

  if p_mode = 'ghost_race' then
    -- The student's own best race in the unit.
    select jsonb_build_object('kind', 'self', 'pattern', to_jsonb(r.pattern)) into rival
    from public.game_runs r
    where r.student_id = uid and r.unit_id = p_unit and r.mode = 'ghost_race' and r.finished_at is not null
    order by r.correct desc, r.finished_at desc limit 1;
    -- Otherwise a classmate of a similar level in the unit (only their answers, never who they are).
    if rival is null then
      select avg(m.score) into my_level from public.mastery m
      join public.skills k on k.id = m.skill_id where m.student_id = uid and k.unit_id = p_unit;
      select jsonb_build_object('kind', 'peer', 'pattern', to_jsonb(r.pattern)) into rival
      from public.game_runs r
      where r.unit_id = p_unit and r.mode = 'ghost_race' and r.finished_at is not null and r.student_id <> uid
        and exists (
          select 1 from public.section_members a join public.section_members b on b.section_id = a.section_id
          where a.student_id = uid and b.student_id = r.student_id
        )
      order by abs(coalesce((select avg(m.score) from public.mastery m join public.skills k on k.id = m.skill_id
                             where m.student_id = r.student_id and k.unit_id = p_unit), 0.5) - coalesce(my_level, 0.5)),
               r.finished_at desc
      limit 1;
    end if;
  end if;

  insert into public.students (id) values (uid) on conflict (id) do nothing;
  insert into public.game_runs (student_id, unit_id, mode, item_ids, rival)
  values (uid, p_unit, p_mode, picked, rival)
  returning id into run;

  return jsonb_build_object(
    'ok', true,
    'run', run,
    'mode', p_mode,
    'rival', rival,
    'pieces', (
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'stem', i.stem, 'options', to_jsonb(i.options),
        'game_public', i.game_public, 'reviewed', i.reviewer_id is not null) order by t.ord)
      from unnest(picked) with ordinality t(id, ord) join public.items i on i.id = t.id
    )
  );
end;
$$;

-- Closes a play: the result comes from the answers recorded in the database, not from the browser.
create function public.finish_game_run(p_run uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.game_runs;
  pat boolean[];
  best integer;
begin
  select * into r from public.game_runs where id = p_run and student_id = uid;
  if not found then
    raise exception 'not your game' using errcode = '42501';
  end if;
  if r.finished_at is not null then
    return jsonb_build_object('correct', r.correct, 'total', r.total, 'pattern', to_jsonb(r.pattern), 'rival', r.rival);
  end if;

  select array_agg(coalesce((
           select a.is_correct from public.attempts a
           where a.session_id = p_run and a.item_id = t.id and a.student_id = uid
           order by a.created_at limit 1), false) order by t.ord)
  into pat
  from unnest(r.item_ids) with ordinality t(id, ord);

  select max(g.correct) into best from public.game_runs g
  where g.student_id = uid and g.unit_id = r.unit_id and g.mode = r.mode and g.finished_at is not null;

  update public.game_runs
  set pattern = pat,
      correct = (select count(*) from unnest(pat) x where x),
      total = cardinality(pat),
      finished_at = now()
  where id = p_run
  returning * into r;

  insert into public.events (actor_id, name, props)
  values (uid, 'game_played', jsonb_build_object('mechanic', r.mode, 'unit', r.unit_id, 'correct', r.correct, 'total', r.total));

  return jsonb_build_object(
    'correct', r.correct, 'total', r.total, 'pattern', to_jsonb(r.pattern), 'rival', r.rival,
    'best_before', best, 'new_record', best is null or r.correct > best
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Recovery codes: from now on, rows added by later phases are moved here, so
-- redeem_recovery_code() does not have to be rewritten each time.
-- ---------------------------------------------------------------------------
create function private.move_student_extras(p_old uuid, p_new uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  n_runs integer;
begin
  update public.game_runs set student_id = p_new where student_id = p_old;
  get diagnostics n_runs = row_count;
  return jsonb_build_object('game_runs', n_runs);
end;
$$;

create or replace function public.redeem_recovery_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  old_id uuid;
  old_nick text;
  old_hidden boolean;
  moved jsonb;
  n_attempts integer;
  n_diagnostics integer;
  n_mastery integer;
  n_weekly integer;
  n_sessions integer;
  n_writing integer;
  n_sections integer;
  n_repairs integer;
  n_groups integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if private.is_staff() then
    raise exception 'staff accounts do not use recovery codes' using errcode = '42501';
  end if;
  if not public.consume_quota('recovery_redeem:' || uid, 5, 900) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if char_length(private.normalize_recovery_code(p_code)) <> 12 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select r.student_id into old_id
  from public.student_recovery_codes r
  where r.code_hash = private.recovery_code_hash(p_code);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if old_id = uid then
    return jsonb_build_object('ok', true, 'already_here', true);
  end if;

  insert into public.students (id) values (uid) on conflict (id) do nothing;
  select nickname, leaderboard_hidden into old_nick, old_hidden from public.students where id = old_id;
  update public.students set nickname = null where id = old_id;
  update public.students s
  set declared_grade_id = coalesce(o.declared_grade_id, s.declared_grade_id),
      nickname = coalesce(old_nick, s.nickname),
      leaderboard_hidden = coalesce(old_hidden, s.leaderboard_hidden)
  from public.students o
  where s.id = uid and o.id = old_id;

  update public.attempts set student_id = uid where student_id = old_id;
  get diagnostics n_attempts = row_count;
  update public.diagnostics set student_id = uid where student_id = old_id;
  get diagnostics n_diagnostics = row_count;

  delete from public.mastery m
  using public.mastery o
  where m.student_id = uid and o.student_id = old_id and o.skill_id = m.skill_id and o.attempts >= m.attempts;
  delete from public.mastery o
  using public.mastery m
  where o.student_id = old_id and m.student_id = uid and m.skill_id = o.skill_id;
  update public.mastery set student_id = uid where student_id = old_id;
  get diagnostics n_mastery = row_count;

  delete from public.mastery_weekly n
  using public.mastery_weekly o
  where n.student_id = uid and o.student_id = old_id and o.skill_id = n.skill_id and o.week_start = n.week_start;
  update public.mastery_weekly set student_id = uid where student_id = old_id;
  get diagnostics n_weekly = row_count;

  update public.tutor_sessions set student_id = uid where student_id = old_id;
  get diagnostics n_sessions = row_count;
  update public.writing_feedback set student_id = uid where student_id = old_id;
  get diagnostics n_writing = row_count;

  delete from public.section_members m
  using public.section_members o
  where m.student_id = uid and o.student_id = old_id and o.section_id = m.section_id;
  update public.section_members set student_id = uid where student_id = old_id;
  get diagnostics n_sections = row_count;

  delete from public.group_members n
  using public.group_members o
  where n.student_id = uid and o.student_id = old_id and o.group_id = n.group_id;
  update public.group_members set student_id = uid where student_id = old_id;
  get diagnostics n_groups = row_count;

  delete from public.streak_repairs n
  using public.streak_repairs o
  where n.student_id = uid and o.student_id = old_id and (o.week_start = n.week_start or o.period_key = n.period_key);
  update public.streak_repairs set student_id = uid where student_id = old_id;
  get diagnostics n_repairs = row_count;

  delete from public.student_recovery_codes where student_id = uid;
  update public.student_recovery_codes set student_id = uid, last_used_at = now() where student_id = old_id;

  moved := jsonb_build_object(
    'attempts', n_attempts, 'diagnostics', n_diagnostics, 'mastery', n_mastery, 'mastery_weekly', n_weekly,
    'tutor_sessions', n_sessions, 'writing_feedback', n_writing, 'sections', n_sections,
    'streak_repairs', n_repairs, 'groups', n_groups
  ) || private.move_student_extras(old_id, uid);

  delete from public.students where id = old_id;

  insert into public.events (actor_id, name, props)
  values (uid, 'recovery_code_redeemed', jsonb_build_object('moved', moved));
  return jsonb_build_object('ok', true, 'already_here', false, 'moved', moved);
end;
$$;

revoke all on function public.games_enabled_for_me() from public;
revoke all on function public.start_game_run(uuid, text) from public, anon;
revoke all on function public.finish_game_run(uuid) from public, anon;
grant execute on function public.games_enabled_for_me() to anon, authenticated;
grant execute on function public.start_game_run(uuid, text) to authenticated;
grant execute on function public.finish_game_run(uuid) to authenticated;
