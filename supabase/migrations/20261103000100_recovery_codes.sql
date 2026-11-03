-- Personal recovery code (docs/producto/gamificacion.md §3.1).
--
-- Students are anonymous Supabase users: their progress lives in one browser. A recovery code lets
-- them carry it to another device WITHOUT an email: redeeming it moves every row of the old
-- anonymous student to the anonymous session of the new device. The account is not converted
-- (the app tells staff from students by is_anonymous), and the code is stored only as a hash.

create table public.student_recovery_codes (
  student_id uuid primary key references public.students (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.student_recovery_codes enable row level security;
-- No policies: nobody reads or writes it through the API, only the functions below.
revoke all on public.student_recovery_codes from anon, authenticated;

-- 12 characters without lookalikes (no 0/O, 1/I/L): about 59 bits.
create function private.recovery_alphabet()
returns text
language sql immutable set search_path = ''
as $$ select '23456789ABCDEFGHJKMNPQRSTUVWXYZ' $$;

-- Upper case, only alphabet characters: "k7qm 4rtx-9pzc" -> "K7QM4RTX9PZC".
create function private.normalize_recovery_code(p_code text)
returns text
language sql immutable set search_path = ''
as $$ select regexp_replace(upper(coalesce(p_code, '')), '[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]', '', 'g') $$;

create function private.recovery_code_hash(p_code text)
returns text
language sql immutable set search_path = ''
as $$ select encode(sha256(convert_to(private.normalize_recovery_code(p_code), 'UTF8')), 'hex') $$;

-- Random code from gen_random_uuid() bytes, with rejection sampling so every character is equally likely.
create function private.generate_recovery_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet text := private.recovery_alphabet();
  n integer := char_length(alphabet);          -- 31
  limit_byte integer := (256 / n) * n;         -- 248: bytes >= this would bias the result
  raw bytea;
  b integer;
  out text := '';
begin
  while char_length(out) < 12 loop
    raw := decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex');
    for i in 0 .. length(raw) - 1 loop
      -- Skip the version/variant nibbles of each UUID (bytes 6 and 8): they are not random.
      continue when i in (6, 8, 22, 24);
      b := get_byte(raw, i);
      continue when b >= limit_byte;
      out := out || substr(alphabet, (b % n) + 1, 1);
      exit when char_length(out) = 12;
    end loop;
  end loop;
  return substr(out, 1, 4) || '-' || substr(out, 5, 4) || '-' || substr(out, 9, 4);
end;
$$;

-- Creates (or replaces) the caller's code and returns it. It is shown once: only the hash is kept.
create function public.create_recovery_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if private.is_staff() then
    raise exception 'staff accounts do not use recovery codes' using errcode = '42501';
  end if;
  if not public.consume_quota('recovery_create:' || uid, 10, 3600) then
    raise exception 'too many codes, try later' using errcode = '54000';
  end if;

  insert into public.students (id) values (uid) on conflict (id) do nothing;

  loop
    code := private.generate_recovery_code();
    begin
      insert into public.student_recovery_codes as r (student_id, code_hash)
      values (uid, private.recovery_code_hash(code))
      on conflict (student_id) do update set code_hash = excluded.code_hash, created_at = now(), last_used_at = null;
      exit;
    exception when unique_violation then
      -- Another student has this code (about 1 in 10^17): draw again.
    end;
  end loop;

  insert into public.events (actor_id, name, props) values (uid, 'recovery_code_created', '{}');
  return code;
end;
$$;

-- Whether the caller already has a code (the code itself cannot be shown again).
create function public.has_recovery_code()
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.student_recovery_codes where student_id = auth.uid()) $$;

-- Moves everything of the student that owns p_code to the caller's anonymous session.
-- A wrong code returns {ok:false} instead of raising: an exception would roll back the
-- consume_quota counter too, and failed guesses would never count against the limit.
-- Every table with a foreign key to students(id) must be handled here; a database test fails
-- when a new one is missing (supabase/tests/rls.test.ts, "recovery covers every student table").
create function public.redeem_recovery_code(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  old_id uuid;
  moved jsonb;
  n_attempts integer;
  n_diagnostics integer;
  n_mastery integer;
  n_sessions integer;
  n_writing integer;
  n_sections integer;
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
  update public.students s
  set declared_grade_id = coalesce(o.declared_grade_id, s.declared_grade_id)
  from public.students o
  where s.id = uid and o.id = old_id;

  update public.attempts set student_id = uid where student_id = old_id;
  get diagnostics n_attempts = row_count;
  update public.diagnostics set student_id = uid where student_id = old_id;
  get diagnostics n_diagnostics = row_count;

  -- Mastery: for a skill both have, keep the row with more attempts (ties: the old one).
  delete from public.mastery m
  using public.mastery o
  where m.student_id = uid and o.student_id = old_id and o.skill_id = m.skill_id and o.attempts >= m.attempts;
  delete from public.mastery o
  using public.mastery m
  where o.student_id = old_id and m.student_id = uid and m.skill_id = o.skill_id;
  update public.mastery set student_id = uid where student_id = old_id;
  get diagnostics n_mastery = row_count;

  update public.tutor_sessions set student_id = uid where student_id = old_id;
  get diagnostics n_sessions = row_count;
  update public.writing_feedback set student_id = uid where student_id = old_id;
  get diagnostics n_writing = row_count;

  -- Sections: the old membership (and its original consent) wins over one made on the new device.
  delete from public.section_members m
  using public.section_members o
  where m.student_id = uid and o.student_id = old_id and o.section_id = m.section_id;
  update public.section_members set student_id = uid where student_id = old_id;
  get diagnostics n_sections = row_count;

  -- The code now belongs to the new session, so it can be used again later.
  delete from public.student_recovery_codes where student_id = uid;
  update public.student_recovery_codes set student_id = uid, last_used_at = now() where student_id = old_id;

  delete from public.students where id = old_id;

  moved := jsonb_build_object(
    'attempts', n_attempts, 'diagnostics', n_diagnostics, 'mastery', n_mastery,
    'tutor_sessions', n_sessions, 'writing_feedback', n_writing, 'sections', n_sections
  );
  insert into public.events (actor_id, name, props)
  values (uid, 'recovery_code_redeemed', jsonb_build_object('moved', moved));
  return jsonb_build_object('ok', true, 'already_here', false, 'moved', moved);
end;
$$;

revoke all on function public.create_recovery_code() from public, anon;
revoke all on function public.has_recovery_code() from public, anon;
revoke all on function public.redeem_recovery_code(text) from public, anon;
grant execute on function public.create_recovery_code() to authenticated;
grant execute on function public.has_recovery_code() to authenticated;
grant execute on function public.redeem_recovery_code(text) to authenticated;
