-- Fase 5 (docs/producto/gamificacion.md §8): symbolic recognition, only for mastery.
--   student_badges     skill mastered, unit mastered, first week met, best streak of 4, 8 and 12.
--                      Awarded by the database (never by the browser) and never taken away.
--   certificates       a unit badge carries a verification code; verify_certificate() confirms it
--                      to anyone, without saying who earned it. The name on the certificate is
--                      typed by the student when printing and never reaches the server.
--   tournament winner  the best team of a closed tournament is highlighted until the next one.
-- The same rules are in packages/curriculum/src/badges.ts; tests compare both.

create table public.student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  badge text not null check (badge in ('skill_mastered', 'unit_mastered', 'first_week', 'streak_4', 'streak_8', 'streak_12')),
  ref_id uuid,                              -- the skill or the unit; null for streak badges
  code text unique,                         -- unit certificates only: «7F3A2-9C01B»
  earned_at timestamptz not null default now(),
  constraint student_badges_once unique nulls not distinct (student_id, badge, ref_id),
  constraint student_badges_ref check ((badge in ('skill_mastered', 'unit_mastered')) = (ref_id is not null)),
  constraint student_badges_code check ((badge = 'unit_mastered') = (code is not null))
);
create index student_badges_student_idx on public.student_badges (student_id, earned_at);

alter table public.student_badges enable row level security;
create policy student_badges_select_own on public.student_badges for select to authenticated
  using (student_id = (select auth.uid()));
revoke insert, update, delete on public.student_badges from anon, authenticated;

create function private.certificate_code()
returns text language sql volatile set search_path = ''
as $$
  select upper(substr(h, 1, 5) || '-' || substr(h, 6, 5))
  from (select replace(gen_random_uuid()::text, '-', '') as h) x
$$;

-- Awards a badge once. Returns true when it is new (and logs badge_earned, without names).
create function private.award_badge(p_student uuid, p_badge text, p_ref uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  added uuid;
begin
  insert into public.student_badges (student_id, badge, ref_id, code)
  values (p_student, p_badge, p_ref, case when p_badge = 'unit_mastered' then private.certificate_code() end)
  on conflict on constraint student_badges_once do nothing
  returning id into added;
  if added is null then
    return false;
  end if;
  insert into public.events (actor_id, name, props)
  values (p_student, 'badge_earned', jsonb_build_object('badge', p_badge)
          || case p_badge when 'skill_mastered' then jsonb_build_object('skill', p_ref)
                          when 'unit_mastered' then jsonb_build_object('unit', p_ref)
                          else '{}'::jsonb end);
  return true;
end;
$$;

-- A unit is mastered when it has skills and every one is at 0.70 or more (unitMastered()).
create function private.unit_mastered_by(p_student uuid, p_unit uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.skills k where k.unit_id = p_unit)
     and not exists (
       select 1 from public.skills k
       left join public.mastery m on m.skill_id = k.id and m.student_id = p_student
       where k.unit_id = p_unit and coalesce(m.score, 0) < 0.7
     )
$$;

-- Skill and unit badges, as soon as mastery reaches 0.70.
create function private.mastery_badges()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  unit uuid;
begin
  if new.score < 0.7 then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if old.score >= 0.7 then
      return null;   -- it already was mastered
    end if;
  end if;
  perform private.award_badge(new.student_id, 'skill_mastered', new.skill_id);
  select k.unit_id into unit from public.skills k where k.id = new.skill_id;
  if unit is not null and private.unit_mastered_by(new.student_id, unit) then
    perform private.award_badge(new.student_id, 'unit_mastered', unit);
  end if;
  return null;
end;
$$;

create trigger mastery_badges_insert
  after insert on public.mastery
  for each row execute function private.mastery_badges();
-- Only a real change of score; moving rows between students (recovery codes) is not one.
create trigger mastery_badges_update
  after update of score on public.mastery
  for each row when (old.student_id = new.student_id and old.score is distinct from new.score)
  execute function private.mastery_badges();

-- Streak badges from the best streak (streakBadges()), while the student can see their streak.
create function private.award_streak_badges(p_student uuid, p_now timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  st jsonb := private.streak_state(p_student, p_now);
  rec integer := coalesce((st ->> 'record')::integer, 0);
begin
  if not coalesce((st ->> 'visible')::boolean, true) then
    return;
  end if;
  if rec >= 1 then perform private.award_badge(p_student, 'first_week', null); end if;
  if rec >= 4 then perform private.award_badge(p_student, 'streak_4', null); end if;
  if rec >= 8 then perform private.award_badge(p_student, 'streak_8', null); end if;
  if rec >= 12 then perform private.award_badge(p_student, 'streak_12', null); end if;
end;
$$;

-- The completed-week trigger of fase 1, now also awarding streak badges.
create or replace function private.attempts_week_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  wk date := private.week_start_cr(new.created_at);
  target integer;
  n_before integer;
  seen boolean;
begin
  if new.is_correct is not true then
    return null;
  end if;
  -- Distinct items answered right this week BEFORE this attempt (by time, then id, so a
  -- multi-row insert is ordered too). Only a new item can complete the week.
  select count(distinct a.item_id), coalesce(bool_or(a.item_id = new.item_id), false) into n_before, seen
  from public.attempts a
  where a.student_id = new.student_id and a.is_correct
    and a.created_at >= private.week_start_instant(wk)
    and (a.created_at < new.created_at or (a.created_at = new.created_at and a.id < new.id));
  if seen then
    return null;
  end if;
  target := private.student_weekly_target(new.student_id);
  if n_before + 1 = target then
    insert into public.events (actor_id, name, props)
    values (new.student_id, 'streak_week_completed', jsonb_build_object('week', wk, 'target', target));
    perform private.award_streak_badges(new.student_id, new.created_at);
  end if;
  return null;
end;
$$;

-- What a student has earned, with what it is about. Also catches up streak badges.
create function public.my_badges()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform private.award_streak_badges(uid, now());
  return jsonb_build_object(
    'record', coalesce((private.streak_state(uid, now()) ->> 'record')::integer, 0),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'badge', b.badge,
        'ref_id', b.ref_id,
        'code', b.code,
        'earned_at', b.earned_at,
        'title', coalesce(k.name, u.title),
        'unit_id', coalesce(k.unit_id, u.id),
        'unit', coalesce(ku.title, u.title),
        'subject', s.name,
        'grade', coalesce(ku.grade_id, u.grade_id)
      ) order by b.earned_at desc)
      from public.student_badges b
      left join public.skills k on b.badge = 'skill_mastered' and k.id = b.ref_id
      left join public.curriculum_units ku on ku.id = k.unit_id
      left join public.curriculum_units u on b.badge = 'unit_mastered' and u.id = b.ref_id
      left join public.subjects s on s.id = coalesce(ku.subject_id, u.subject_id)
      where b.student_id = uid
    ), '[]'::jsonb)
  );
end;
$$;

-- Anyone can check a certificate: the unit, its skills and the date. Never who earned it.
create function public.verify_certificate(p_code text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'valid', true,
      'unit', u.title,
      'subject', s.name,
      'grade', u.grade_id,
      'earned_on', (b.earned_at at time zone 'America/Costa_Rica')::date,
      'skills', coalesce((select jsonb_agg(k.name order by k.sort_order) from public.skills k where k.unit_id = u.id), '[]'::jsonb)
    )
    from public.student_badges b
    join public.curriculum_units u on u.id = b.ref_id
    join public.subjects s on s.id = u.subject_id
    where b.badge = 'unit_mastered'
      and b.code = upper(regexp_replace(coalesce(p_code, ''), '^\s*([0-9A-Fa-f]{5})-?([0-9A-Fa-f]{5})\s*$', '\1-\2'))
  ), jsonb_build_object('valid', false))
$$;

-- The student printed or saved their certificate (only the unit; the name stays on the device).
create function public.log_certificate_download(p_unit uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (
    select 1 from public.student_badges b where b.student_id = uid and b.badge = 'unit_mastered' and b.ref_id = p_unit
  ) then
    return false;
  end if;
  insert into public.events (actor_id, name, props) values (uid, 'certificate_downloaded', jsonb_build_object('unit', p_unit));
  return true;
end;
$$;

-- Badges for what students already mastered before this phase (no events: nobody earned them now).
insert into public.student_badges (student_id, badge, ref_id, earned_at)
select m.student_id, 'skill_mastered', m.skill_id, m.updated_at
from public.mastery m where m.score >= 0.7
on conflict on constraint student_badges_once do nothing;

insert into public.student_badges (student_id, badge, ref_id, code, earned_at)
select x.student_id, 'unit_mastered', x.unit_id, private.certificate_code(), x.at
from (
  select m.student_id, k.unit_id, max(m.updated_at) as at
  from public.mastery m join public.skills k on k.id = m.skill_id
  group by m.student_id, k.unit_id
) x
where private.unit_mastered_by(x.student_id, x.unit_id)
on conflict on constraint student_badges_once do nothing;

-- ---------------------------------------------------------------------------
-- The winning team of a closed tournament (tournamentWinners()), until the next one opens.
-- ---------------------------------------------------------------------------
create function private.tournament_winners(p_tournament uuid, p_now timestamptz)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with teams as (select * from private.tournament_team_scores(p_tournament))
  select case when p_now < (select closes_at from public.tournaments where id = p_tournament) then '[]'::jsonb
    else coalesce((
      select jsonb_agg(t.name order by t.name collate "C") from teams t
      where t.score > 0 and t.score = (select max(score) from teams)
    ), '[]'::jsonb) end
$$;

drop function private.tournament_student_view(uuid, uuid);
create function private.tournament_student_view(p_tournament uuid, p_student uuid, p_now timestamptz)
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
    'closed', p_now >= x.closes_at,
    'winners', private.tournament_winners(p_tournament, p_now),
    'topics', private.tournament_topics(p_tournament),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'score', t.score, 'me', coalesce(t.team_id = (select team_id from mine), false)) order by t.score desc, t.name)
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

create or replace function private.section_tournament_at(p_section uuid, p_now timestamptz)
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
    'tournament', case when pick.tournament_id is null then null else private.tournament_student_view(pick.tournament_id, uid, p_now) end
  );
end;
$$;

create or replace function private.section_tournament_report_at(p_section uuid, p_now timestamptz)
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
      'closed', p_now >= x.closes_at,
      'winners', private.tournament_winners(x.id, p_now),
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

-- For the group's guide (or whoever manages the group): the latest tournament of every subject
-- section of the group, with its winners once it closed. Read-only: it never builds a tournament.
create function public.group_tournaments(p_group uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (private.is_group_guide(p_group) or private.manages_group(p_group)) then
    raise exception 'not your group' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'section', s.name,
      'subject', sub.name,
      'week_start', t.week_start,
      'closed', now() >= t.closes_at,
      'winners', private.tournament_winners(t.id, now())
    ) order by sub.name)
    from public.sections s
    join public.subjects sub on sub.id = s.subject_id
    join lateral (
      select x.* from public.tournaments x where x.section_id = s.id order by x.week_start desc limit 1
    ) t on true
    where s.group_id = p_group
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Recovery codes also move badges (the old device's wins on a repeat; codes keep working).
-- ---------------------------------------------------------------------------
create or replace function private.move_student_extras(p_old uuid, p_new uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  n_runs integer;
  n_tournaments integer;
  n_badges integer;
begin
  update public.game_runs set student_id = p_new where student_id = p_old;
  get diagnostics n_runs = row_count;
  delete from public.tournament_members n
  using public.tournament_members o
  where n.student_id = p_new and o.student_id = p_old and o.tournament_id = n.tournament_id;
  update public.tournament_members set student_id = p_new where student_id = p_old;
  get diagnostics n_tournaments = row_count;
  delete from public.student_badges n
  using public.student_badges o
  where n.student_id = p_new and o.student_id = p_old and o.badge = n.badge and o.ref_id is not distinct from n.ref_id;
  update public.student_badges set student_id = p_new where student_id = p_old;
  get diagnostics n_badges = row_count;
  return jsonb_build_object('game_runs', n_runs, 'tournaments', n_tournaments, 'badges', n_badges);
end;
$$;

revoke all on function public.my_badges() from public, anon;
revoke all on function public.log_certificate_download(uuid) from public, anon;
revoke all on function public.group_tournaments(uuid) from public, anon;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.my_badges() to authenticated;
grant execute on function public.log_certificate_download(uuid) to authenticated;
grant execute on function public.group_tournaments(uuid) to authenticated;
grant execute on function public.verify_certificate(text) to anon, authenticated;
