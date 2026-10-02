-- Phase 3: mastery per skill and the adaptive diagnostic, computed in the database so a
-- student cannot write their own scores. Same formulas as packages/curriculum/src/learning.ts
-- (explained in docs/diagnostic.md); supabase/tests checks both give the same numbers.

-- Elo-style update of one skill after one answer (see learning.ts: updateMastery).
create function private.mastery_after(p_score numeric, p_attempts integer, p_difficulty integer, p_correct boolean)
returns numeric
language plpgsql immutable set search_path = ''
as $$
declare
  s numeric := least(0.98, greatest(0.02, coalesce(p_score, 0.5)));
  theta double precision := ln(s / (1 - s));
  b double precision := (least(5, greatest(1, p_difficulty)) - 3) * 0.8;
  k double precision := greatest(0.3, 1.2 / (1 + 0.25 * greatest(0, p_attempts)));
  p double precision := 1 / (1 + exp(-(theta - b)));
  next double precision := theta + k * ((case when p_correct then 1 else 0 end) - p);
begin
  return least(0.98, greatest(0.02, 1 / (1 + exp(-next))))::numeric;
end;
$$;

-- MAP ability estimate with a N(0,1) prior (see learning.ts: estimateAbility).
create function private.estimate_ability(p_difficulties integer[], p_correct boolean[])
returns double precision
language plpgsql immutable set search_path = ''
as $$
declare
  theta double precision := 0;
  gradient double precision;
  curvature double precision;
  p double precision;
  step double precision;
begin
  for iter in 1..25 loop
    gradient := -theta;
    curvature := -1;
    for i in 1..coalesce(array_length(p_difficulties, 1), 0) loop
      p := 1 / (1 + exp(-(theta - (least(5, greatest(1, p_difficulties[i])) - 3) * 0.8)));
      gradient := gradient + (case when p_correct[i] then 1 else 0 end) - p;
      curvature := curvature - p * (1 - p);
    end loop;
    step := gradient / curvature;
    theta := theta - step;
    exit when abs(step) < 1e-6;
  end loop;
  return theta;
end;
$$;

-- submit_attempt now also updates the student's mastery of the item's skills.
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
    if not it.verified then
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

  insert into public.students (id) values (uid) on conflict (id) do nothing;

  if it.kind = 'single_choice' then
    correct := p_answer_index is not null and p_answer_index = it.correct_index;
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
      values (uid, skill, private.mastery_after(null, 0, it.difficulty, correct), 1, now())
      on conflict (student_id, skill_id) do update
        set score = private.mastery_after(m.score, m.attempts, it.difficulty, correct),
            attempts = m.attempts + 1,
            updated_at = now();
    end loop;
  end if;

  return jsonb_build_object(
    'is_correct', correct,
    'correct_index', it.correct_index,
    'explanation', it.explanation,
    'distractor_explanations', to_jsonb(it.distractor_explanations)
  );
end;
$$;

-- Starts a diagnostic for one subject and grade; an unfinished earlier one is abandoned.
create function public.start_diagnostic(p_subject_id text, p_grade_id smallint)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.students (id, declared_grade_id) values (uid, p_grade_id) on conflict (id) do nothing;
  update public.diagnostics set status = 'abandoned'
  where student_id = uid and subject_id = p_subject_id and grade_id = p_grade_id and status = 'in_progress';
  insert into public.diagnostics (student_id, subject_id, grade_id)
  values (uid, p_subject_id, p_grade_id)
  returning id into new_id;
  return new_id;
end;
$$;

-- Closes a diagnostic: level from its own answers, plus the student's mastery of the skills it touched.
create function public.finish_diagnostic(p_diagnostic_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  diffs integer[];
  oks boolean[];
  theta double precision;
  level numeric;
  detail jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.diagnostics d where d.id = p_diagnostic_id and d.student_id = uid and d.status = 'in_progress'
  ) then
    raise exception 'invalid diagnostic' using errcode = '22023';
  end if;

  select coalesce(array_agg(i.difficulty::integer order by a.created_at), '{}'),
         coalesce(array_agg(a.is_correct order by a.created_at), '{}')
    into diffs, oks
  from public.attempts a join public.items i on i.id = a.item_id
  where a.diagnostic_id = p_diagnostic_id and a.is_correct is not null;

  if coalesce(array_length(diffs, 1), 0) = 0 then
    update public.diagnostics set status = 'abandoned' where id = p_diagnostic_id;
    return jsonb_build_object('status', 'abandoned');
  end if;

  theta := private.estimate_ability(diffs, oks);
  level := round(least(5, greatest(1, 3 + theta / 0.8))::numeric, 1);

  select coalesce(jsonb_object_agg(m.skill_id, round(m.score, 3)), '{}') into detail
  from public.mastery m
  where m.student_id = uid
    and m.skill_id in (
      select unnest(i.skill_ids) from public.attempts a join public.items i on i.id = a.item_id
      where a.diagnostic_id = p_diagnostic_id
    );

  update public.diagnostics
     set status = 'completed', estimated_level = level, skill_detail = detail, completed_at = now()
   where id = p_diagnostic_id;

  return jsonb_build_object(
    'status', 'completed',
    'level', level,
    'theta', theta,
    'answered', array_length(diffs, 1),
    'correct', (select count(*) from unnest(oks) x where x)
  );
end;
$$;

revoke all on function public.start_diagnostic(text, smallint) from public, anon;
revoke all on function public.finish_diagnostic(uuid) from public, anon;
grant execute on function public.start_diagnostic(text, smallint) to authenticated;
grant execute on function public.finish_diagnostic(uuid) to authenticated;

-- Practice without a session: grades one answer and stores nothing. The fallback when an
-- anonymous session cannot be created (for example, Supabase's per-IP limit on anonymous
-- sign-ins when a whole classroom shares one IP). Reveals no more than submit_attempt, which
-- any anonymous session can call.
create function public.check_answer(p_item_id uuid, p_answer_index smallint)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  it public.items;
begin
  select i.* into it from public.items i
  where i.id = p_item_id
    and i.status = 'published'
    and i.kind = 'single_choice'
    and private.unit_is_published(i.unit_id);
  if not found then
    raise exception 'item not available' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'is_correct', p_answer_index is not null and p_answer_index = it.correct_index,
    'correct_index', it.correct_index,
    'explanation', it.explanation,
    'distractor_explanations', to_jsonb(it.distractor_explanations)
  );
end;
$$;
grant execute on function public.check_answer(uuid, smallint) to anon, authenticated;
