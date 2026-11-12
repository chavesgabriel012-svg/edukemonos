-- Groups and one section per subject (docs/producto/gamificacion.md §12, founder's decision of 5 Nov):
--
--   Group (grupo, e.g. 7-3)  one join code; the student joins once and is in every subject of the group.
--   Teacher = subject        a section with a subject inside a group; the teacher sees only that subject.
--   Guide (profesor guía)    optional, one per group; sees every subject of the group's students.
--   Student                  in their group, sees the subjects of their group.
--
-- Sections without a subject (created before this change, or standalone) keep working as before:
-- their teacher sees every subject of their students.

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),     -- '7-3'
  grade_id smallint not null references public.grades (id),
  institution_id uuid references public.institutions (id) on delete cascade,
  guide_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  join_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index groups_institution_idx on public.groups (institution_id);
create index groups_guide_idx on public.groups (guide_id);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  -- Only for the group's teachers and guide to recognise the student. NEVER sent to the AI model.
  display_name text not null check (char_length(display_name) between 1 and 60),
  consent_at timestamptz not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, student_id)
);
create index group_members_student_idx on public.group_members (student_id);

alter table public.sections
  add column subject_id text references public.subjects (id),
  add column group_id uuid references public.groups (id) on delete cascade,
  add constraint sections_group_needs_subject check (group_id is null or subject_id is not null);
-- One section per subject in a group.
create unique index sections_group_subject_idx on public.sections (group_id, subject_id) where group_id is not null;

-- ---------------------------------------------------------------------------
-- Who is who
-- ---------------------------------------------------------------------------
-- Manages a group: its creator, an admin of its institution, or a platform admin.
create function private.manages_group(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = p_group
      and (g.created_by = (select auth.uid())
           or (g.institution_id is not null and private.is_institution_admin(g.institution_id))
           or private.is_admin())
  )
$$;

-- May add a subject section to the group: who manages it, or any teacher of its institution.
create function private.can_teach_in_group(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.manages_group(p_group) or exists (
    select 1 from public.groups g
    where g.id = p_group and g.institution_id is not null and private.institution_role(g.institution_id) is not null
  )
$$;

create function private.is_group_guide(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.groups g where g.id = p_group and g.guide_id = (select auth.uid())) $$;

-- The group has a section of the current teacher.
create function private.teaches_in_group(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.sections s where s.group_id = p_group and s.teacher_id = (select auth.uid())) $$;

create function private.guides_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm join public.groups g on g.id = gm.group_id
    where gm.student_id = p_student and g.guide_id = (select auth.uid())
  )
$$;

create function private.is_group_member(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.group_members gm where gm.group_id = p_group and gm.student_id = (select auth.uid())) $$;

-- Teaches the student in any subject, or is their guide: may see who they are (students row,
-- streak repairs). Learning data by subject uses can_see_student_subject() instead.
create or replace function private.teaches_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.section_members m
    join public.sections s on s.id = m.section_id
    where m.student_id = p_student_id and s.teacher_id = (select auth.uid())
  ) or private.guides_student(p_student_id)
$$;

-- Learning data of a subject: the teacher of a section with that subject (or without subject, as
-- before) that the student is in, or the student's guide. A row with no subject (a tutor session
-- outside a unit) is only for whole-student views: sections without subject and guides.
create function private.can_see_student_subject(p_student uuid, p_subject text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.section_members m
    join public.sections s on s.id = m.section_id
    where m.student_id = p_student and s.teacher_id = (select auth.uid())
      and (s.subject_id is null or s.subject_id = p_subject)
  ) or private.guides_student(p_student)
$$;

-- ---------------------------------------------------------------------------
-- The subject of every learning row, stored with it (fast RLS without joins)
-- ---------------------------------------------------------------------------
alter table public.attempts add column subject_id text references public.subjects (id);
alter table public.mastery add column subject_id text references public.subjects (id);
alter table public.mastery_weekly add column subject_id text references public.subjects (id);
alter table public.tutor_sessions add column subject_id text references public.subjects (id);
alter table public.writing_feedback add column subject_id text references public.subjects (id);

create function private.set_subject_from_item()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select u.subject_id into new.subject_id
  from public.items i join public.curriculum_units u on u.id = i.unit_id
  where i.id = new.item_id;
  return new;
end;
$$;

create function private.set_subject_from_skill()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  select k.subject_id into new.subject_id from public.skills k where k.id = new.skill_id;
  return new;
end;
$$;

create function private.set_subject_from_unit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.unit_id is null then
    new.subject_id := null;
  else
    select u.subject_id into new.subject_id from public.curriculum_units u where u.id = new.unit_id;
  end if;
  return new;
end;
$$;

create trigger attempts_subject before insert or update of item_id on public.attempts
  for each row execute function private.set_subject_from_item();
create trigger mastery_subject before insert or update of skill_id on public.mastery
  for each row execute function private.set_subject_from_skill();
create trigger mastery_weekly_subject before insert or update of skill_id on public.mastery_weekly
  for each row execute function private.set_subject_from_skill();
create trigger tutor_sessions_subject before insert or update of unit_id on public.tutor_sessions
  for each row execute function private.set_subject_from_unit();
create trigger writing_feedback_subject before insert or update of unit_id on public.writing_feedback
  for each row execute function private.set_subject_from_unit();

-- Backfill what already exists.
update public.attempts a set subject_id = u.subject_id
from public.items i join public.curriculum_units u on u.id = i.unit_id where i.id = a.item_id;
update public.mastery m set subject_id = k.subject_id from public.skills k where k.id = m.skill_id;
update public.mastery_weekly w set subject_id = k.subject_id from public.skills k where k.id = w.skill_id;
update public.tutor_sessions t set subject_id = u.subject_id from public.curriculum_units u where u.id = t.unit_id;
update public.writing_feedback f set subject_id = u.subject_id from public.curriculum_units u where u.id = f.unit_id;

create index attempts_student_subject_idx on public.attempts (student_id, subject_id, created_at);

-- ---------------------------------------------------------------------------
-- Policies: teachers see learning data of their subject only; guides, of every subject.
-- ---------------------------------------------------------------------------
drop policy attempts_select on public.attempts;
create policy attempts_select on public.attempts for select to authenticated
  using (student_id = (select auth.uid()) or private.can_see_student_subject(student_id, subject_id));

drop policy diagnostics_select on public.diagnostics;
create policy diagnostics_select on public.diagnostics for select to authenticated
  using (student_id = (select auth.uid()) or private.can_see_student_subject(student_id, subject_id));

drop policy mastery_select on public.mastery;
create policy mastery_select on public.mastery for select to authenticated
  using (student_id = (select auth.uid()) or private.can_see_student_subject(student_id, subject_id));

drop policy mastery_weekly_select on public.mastery_weekly;
create policy mastery_weekly_select on public.mastery_weekly for select to authenticated
  using (student_id = (select auth.uid()) or private.can_see_student_subject(student_id, subject_id));

drop policy tutor_sessions_select on public.tutor_sessions;
create policy tutor_sessions_select on public.tutor_sessions for select to authenticated
  using (student_id = (select auth.uid()) or private.can_see_student_subject(student_id, subject_id));

drop policy writing_feedback_select on public.writing_feedback;
create policy writing_feedback_select on public.writing_feedback for select to authenticated
  using (student_id = (select auth.uid()) or private.can_see_student_subject(student_id, subject_id));

-- What a section covers: its grade, and its subject when it has one (fase 2 goal and table).
create or replace function private.section_scope_skills(p_section uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select k.id from public.skills k join public.sections s on s.grade_id = k.grade_id
  where s.id = p_section and (s.subject_id is null or k.subject_id = s.subject_id)
$$;

-- ---------------------------------------------------------------------------
-- Codes: one alphabet and one namespace for sections and groups
-- ---------------------------------------------------------------------------
create or replace function private.generate_join_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.sections s where s.join_code = code)
          and not exists (select 1 from public.groups g where g.join_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sections in a group: grade and institution come from the group; members come from the group.
-- ---------------------------------------------------------------------------
create function private.sections_group_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if new.group_id is null then
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
  new.grade_id := g.grade_id;
  new.institution_id := g.institution_id;
  return new;
end;
$$;

create trigger sections_group_check
  before insert or update of group_id, grade_id, subject_id on public.sections
  for each row execute function private.sections_group_check();

create function private.sections_group_members()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.group_id is not null then
    insert into public.section_members (section_id, student_id, display_name, consent_at)
    select new.id, gm.student_id, gm.display_name, gm.consent_at
    from public.group_members gm where gm.group_id = new.group_id
    on conflict on constraint section_members_pkey do nothing;
  end if;
  return null;
end;
$$;

create trigger sections_group_members
  after insert or update of group_id on public.sections
  for each row execute function private.sections_group_members();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
-- Creates a group. With an institution, only its admins; without one, any teacher (standalone).
create function public.create_group(p_name text, p_grade smallint, p_institution uuid default null)
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
  if p_institution is not null and not private.is_institution_admin(p_institution) then
    raise exception 'not an admin of this institution' using errcode = '42501';
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

create function public.regenerate_group_code(p_group uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  code text;
begin
  if not private.manages_group(p_group) then
    raise exception 'not your group' using errcode = '42501';
  end if;
  code := private.generate_join_code();
  update public.groups set join_code = code where id = p_group;
  return code;
end;
$$;

-- Sets (or removes, with null) the group's guide, by the email they sign in with.
create function public.set_group_guide(p_group uuid, p_email text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  inst uuid;
begin
  if not private.manages_group(p_group) then
    raise exception 'not your group' using errcode = '42501';
  end if;
  if p_email is null or btrim(p_email) = '' then
    update public.groups set guide_id = null where id = p_group;
    return true;
  end if;
  select p.id into pid from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = lower(btrim(p_email));
  if pid is null then
    return false;                      -- the person has to sign in to Eduka once first
  end if;
  select institution_id into inst from public.groups where id = p_group;
  if inst is not null and not exists (select 1 from public.institution_members where institution_id = inst and profile_id = pid) then
    raise exception 'the guide must belong to the institution' using errcode = '42501';
  end if;
  update public.groups set guide_id = pid where id = p_group;
  return true;
end;
$$;

-- One code for everything: a group code puts the student in every subject of the group; a section
-- code of a section in a group puts them in the whole group; a standalone section code works as before.
create function public.join_with_code(p_code text, p_display_name text, p_consent boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text := upper(replace(btrim(coalesce(p_code, '')), '-', ''));
  clean_name text := btrim(p_display_name);
  g public.groups;
  sec public.sections;
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

-- Takes a student out of the group and of all its subject sections. Managers and the guide.
create function public.remove_group_member(p_group uuid, p_student uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (private.manages_group(p_group) or private.is_group_guide(p_group)) then
    raise exception 'not your group' using errcode = '42501';
  end if;
  delete from public.section_members m using public.sections s
  where s.id = m.section_id and s.group_id = p_group and m.student_id = p_student;
  delete from public.group_members where group_id = p_group and student_id = p_student;
end;
$$;

-- A group as its teachers see it: subjects with their teacher and how many students.
create function public.group_overview(p_group uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  -- Also the institution's teachers who do not teach in it yet: they open it to add their subject.
  if not (private.manages_group(p_group) or private.is_group_guide(p_group) or private.can_teach_in_group(p_group)) then
    raise exception 'not your group' using errcode = '42501';
  end if;
  select * into g from public.groups where id = p_group;
  return jsonb_build_object(
    'id', g.id, 'name', g.name, 'grade_id', g.grade_id, 'join_code', g.join_code, 'active', g.active,
    'institution', (select name from public.institutions where id = g.institution_id),
    'manages', private.manages_group(p_group),
    'can_teach', private.can_teach_in_group(p_group),
    'is_guide', private.is_group_guide(p_group),
    'guide', (select coalesce(nullif(p.display_name, ''), 'Docente') from public.profiles p where p.id = g.guide_id),
    'students', (select count(*) from public.group_members where group_id = p_group),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'subject_id', s.subject_id, 'subject', sub.name,
        'teacher', coalesce(nullif(p.display_name, ''), 'Docente'),
        'mine', s.teacher_id = (select auth.uid())) order by sub.sort)
      from public.sections s join public.subjects sub on sub.id = s.subject_id join public.profiles p on p.id = s.teacher_id
      where s.group_id = p_group), '[]')
  );
end;
$$;

-- Recovery codes also move group memberships.
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
  update public.students set nickname = null where id = old_id;   -- frees it (unique)
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

  -- Weekly changes: the old device's record wins for the same skill and week.
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

  -- Groups: the old membership (and its original consent) wins.
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

  delete from public.students where id = old_id;

  moved := jsonb_build_object(
    'attempts', n_attempts, 'diagnostics', n_diagnostics, 'mastery', n_mastery, 'mastery_weekly', n_weekly,
    'tutor_sessions', n_sessions, 'writing_feedback', n_writing, 'sections', n_sections,
    'streak_repairs', n_repairs, 'groups', n_groups
  );
  insert into public.events (actor_id, name, props)
  values (uid, 'recovery_code_redeemed', jsonb_build_object('moved', moved));
  return jsonb_build_object('ok', true, 'already_here', false, 'moved', moved);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Groups: who manages it, its guide, its teachers, the teachers of its institution (to add their
-- subject) and its students (to see its name).
create policy groups_select on public.groups for select to authenticated
  using (private.manages_group(id) or guide_id = (select auth.uid()) or private.teaches_in_group(id)
         or (institution_id is not null and private.institution_role(institution_id) is not null)
         or private.is_group_member(id));
create policy groups_update on public.groups for update to authenticated
  using (private.manages_group(id)) with check (private.manages_group(id));
revoke insert, delete on public.groups from anon, authenticated;
revoke update on public.groups from anon, authenticated;
grant update (name, active) on public.groups to authenticated;

-- Group members: the student, the group's guide and managers, and its subject teachers.
create policy group_members_select on public.group_members for select to authenticated
  using (student_id = (select auth.uid()) or private.manages_group(group_id)
         or private.is_group_guide(group_id) or private.teaches_in_group(group_id));
revoke insert, update, delete on public.group_members from anon, authenticated;

revoke all on function public.create_group(text, smallint, uuid) from public, anon;
revoke all on function public.regenerate_group_code(uuid) from public, anon;
revoke all on function public.set_group_guide(uuid, text) from public, anon;
revoke all on function public.join_with_code(text, text, boolean) from public, anon;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
revoke all on function public.group_overview(uuid) from public, anon;
grant execute on function public.create_group(text, smallint, uuid) to authenticated;
grant execute on function public.regenerate_group_code(uuid) to authenticated;
grant execute on function public.set_group_guide(uuid, text) to authenticated;
grant execute on function public.join_with_code(text, text, boolean) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.group_overview(uuid) to authenticated;
