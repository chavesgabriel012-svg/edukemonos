-- Helper functions, triggers and RPCs.
-- SECURITY DEFINER functions always pin `search_path = ''` and use qualified names.

-- ---------------------------------------------------------------------------
-- Role helpers (private, used by RLS policies)
-- ---------------------------------------------------------------------------
create function private.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create function private.is_reviewer()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('reviewer', 'admin'), false)
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false)
$$;

create function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.current_app_role() is not null
$$;

create function private.owns_section(p_section_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.sections s
    where s.id = p_section_id and s.teacher_id = (select auth.uid())
  )
$$;

-- True when the current user teaches a section the student belongs to.
create function private.teaches_student(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.section_members m
    join public.sections s on s.id = m.section_id
    where m.student_id = p_student_id and s.teacher_id = (select auth.uid())
  )
$$;

create function private.is_section_member(p_section_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.section_members m
    where m.section_id = p_section_id and m.student_id = (select auth.uid())
  )
$$;

create function private.unit_is_published(p_unit_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.curriculum_units u
    where u.id = p_unit_id and u.status = 'published'
  )
$$;

create function private.owns_tutor_session(p_session_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tutor_sessions t
    where t.id = p_session_id and t.student_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Full-text search (Spanish), used by RAG before any embeddings (SPEC §5)
-- ---------------------------------------------------------------------------
-- array_to_string is only STABLE; generated columns need IMMUTABLE.
create function private.immutable_array_to_string(text[], text)
returns text
language sql immutable parallel safe
as $$ select array_to_string($1, $2) $$;

alter table public.curriculum_units add column search tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A')
    || setweight(to_tsvector('spanish', private.immutable_array_to_string(learning_outcomes, ' ')), 'B')
    || setweight(to_tsvector('spanish', private.immutable_array_to_string(contents, ' ')), 'B')
  ) stored;
create index curriculum_units_search_idx on public.curriculum_units using gin (search);

alter table public.materials add column search tsvector
  generated always as (to_tsvector('spanish', content)) stored;
create index materials_search_idx on public.materials using gin (search);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger curriculum_units_updated_at
  before update on public.curriculum_units
  for each row execute function private.set_updated_at();

-- Staff accounts get a profile automatically; anonymous (student) users never do.
create function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) = false then
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Easy to dictate in class: no 0/O, 1/I/L. Format 'ABC-123' style, 6 symbols.
create function private.generate_join_code()
returns text language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.sections s where s.join_code = code);
  end loop;
  return code;
end;
$$;

create function private.sections_before_write()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.join_code := private.generate_join_code();
  elsif new.teacher_id <> old.teacher_id then
    raise exception 'teacher_id cannot change';
  elsif new.join_code <> old.join_code
        and coalesce(current_setting('app.allow_join_code_change', true), '') <> 'on' then
    raise exception 'use regenerate_join_code()';
  end if;
  return new;
end;
$$;

create trigger sections_before_write
  before insert or update on public.sections
  for each row execute function private.sections_before_write();

-- ---------------------------------------------------------------------------
-- RPCs callable by clients
-- ---------------------------------------------------------------------------

-- Student joins a section with the teacher's code, a display name and explicit consent.
create function public.join_section(p_code text, p_display_name text, p_consent boolean)
returns table (section_id uuid, section_name text, grade_id smallint)
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sec public.sections;
  clean_name text := btrim(p_display_name);
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

  select * into sec from public.sections s
  where s.join_code = upper(replace(btrim(p_code), '-', '')) and s.active;
  if not found then
    raise exception 'invalid or inactive code' using errcode = 'P0002';
  end if;

  insert into public.students (id, declared_grade_id)
  values (uid, sec.grade_id)
  on conflict (id) do nothing;

  insert into public.section_members (section_id, student_id, display_name, consent_at)
  values (sec.id, uid, clean_name, now())
  on conflict on constraint section_members_pkey
  do update set display_name = excluded.display_name, consent_at = excluded.consent_at;

  return query select sec.id, sec.name, sec.grade_id;
end;
$$;

create function public.regenerate_join_code(p_section_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  new_code text;
begin
  if not private.owns_section(p_section_id) then
    raise exception 'not your section' using errcode = '42501';
  end if;
  new_code := private.generate_join_code();
  perform set_config('app.allow_join_code_change', 'on', true);
  update public.sections set join_code = new_code where id = p_section_id;
  perform set_config('app.allow_join_code_change', '', true);
  return new_code;
end;
$$;

-- Records an attempt and grades it server-side, so answers never travel to the client
-- before the student answers. Diagnostic attempts only accept verified items.
create function public.submit_attempt(
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

  return jsonb_build_object(
    'is_correct', correct,
    'correct_index', it.correct_index,
    'explanation', it.explanation,
    'distractor_explanations', to_jsonb(it.distractor_explanations)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Server-only functions (service_role)
-- ---------------------------------------------------------------------------

-- Fixed-window rate limit. Returns true when the call is allowed.
create function public.consume_quota(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  current_count integer;
begin
  insert into public.quota_counters as q (key, window_start, count)
  values (p_key, win, 1)
  on conflict (key, window_start) do update set count = q.count + 1
  returning q.count into current_count;
  return current_count <= p_limit;
end;
$$;

-- Retention: delete tutor transcripts older than N days (RETENTION_DAYS_CHAT).
create function public.purge_expired_tutor_messages(p_days integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.tutor_messages where created_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  delete from public.quota_counters where window_start < now() - interval '2 days';
  return n;
end;
$$;

revoke execute on function public.consume_quota(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.purge_expired_tutor_messages(integer) from public, anon, authenticated;
grant execute on function public.consume_quota(text, integer, integer) to service_role;
grant execute on function public.purge_expired_tutor_messages(integer) to service_role;

revoke execute on function public.join_section(text, text, boolean) from public, anon;
revoke execute on function public.regenerate_join_code(uuid) from public, anon;
revoke execute on function public.submit_attempt(uuid, smallint, text, integer, smallint, uuid, public.attempt_context, uuid) from public, anon;
grant execute on function public.join_section(text, text, boolean) to authenticated;
grant execute on function public.regenerate_join_code(uuid) to authenticated;
grant execute on function public.submit_attempt(uuid, smallint, text, integer, smallint, uuid, public.attempt_context, uuid) to authenticated;
