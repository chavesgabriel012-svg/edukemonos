-- Edukemonos core schema.
-- Cycle, grade and subject are catalog DATA (not code), so I/II Ciclo and
-- Diversificada can be added later with inserts only (SPEC §2).

create extension if not exists pgcrypto with schema extensions;

-- Helpers that must not be exposed through the API live in `private`.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('teacher', 'reviewer', 'admin');
-- Curriculum units: nothing reaches students until a reviewer publishes it.
create type public.unit_status as enum ('draft', 'reviewed', 'published', 'rejected');
-- Materials and items: `status` controls visibility, `reviewed_at` controls the
-- "revisado por docente" vs "pendiente de revisión" label (SPEC §4.4, §8).
create type public.content_status as enum ('draft', 'published', 'rejected');
create type public.source_kind as enum ('program', 'spec_table', 'practice');
create type public.material_kind as enum ('summary', 'explanation', 'worked_examples', 'glossary');
create type public.item_kind as enum ('single_choice', 'open_writing');
create type public.item_origin as enum ('bulk', 'on_demand', 'manual');
create type public.attempt_context as enum ('practice', 'diagnostic');
create type public.diagnostic_status as enum ('in_progress', 'completed', 'abandoned');
create type public.report_target as enum ('unit', 'material', 'item', 'tutor_message');
create type public.report_status as enum ('open', 'triaged', 'resolved', 'dismissed');
create type public.tutor_role as enum ('user', 'assistant', 'tool');

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.cycles (
  id text primary key,                 -- 'I', 'II', 'III', 'diversificada'
  name text not null,
  sort smallint not null
);

create table public.grades (
  id smallint primary key,             -- 1..12, matches the school year number
  cycle_id text not null references public.cycles (id),
  name text not null,                  -- 'Sétimo año'
  sort smallint not null
);

create table public.subjects (
  id text primary key,                 -- 'matematicas', 'espanol', ...
  name text not null,
  sort smallint not null,
  available boolean not null default false  -- false => shown as "próximamente"
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
-- Staff accounts (teachers, reviewers, admins). Students never get a profile.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'teacher',
  display_name text not null default '' check (char_length(display_name) <= 120),
  created_at timestamptz not null default now()
);

-- Students are Supabase anonymous users. Only the declared grade is stored here.
create table public.students (
  id uuid primary key references auth.users (id) on delete cascade,
  declared_grade_id smallint references public.grades (id),
  created_at timestamptz not null default now()
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  grade_id smallint not null references public.grades (id),
  institution_text text check (char_length(institution_text) <= 160),
  current_term smallint check (current_term between 1 and 3),
  join_code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index sections_teacher_idx on public.sections (teacher_id);

create table public.section_members (
  section_id uuid not null references public.sections (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  -- The name is only for the teacher to recognise the student. It is NEVER sent to the AI model.
  display_name text not null check (char_length(display_name) between 1 and 60),
  consent_at timestamptz not null,
  joined_at timestamptz not null default now(),
  primary key (section_id, student_id)
);
create index section_members_student_idx on public.section_members (student_id);

-- ---------------------------------------------------------------------------
-- Curriculum map
-- ---------------------------------------------------------------------------
create table public.curriculum_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,     -- id from scripts/ingest/sources.json
  kind public.source_kind not null,
  subject_id text not null references public.subjects (id),
  cycle_id text not null references public.cycles (id),
  title text not null,
  version text,
  url text not null,
  storage_path text,                   -- private bucket path, null until downloaded
  sha256 text,
  bytes bigint,
  pdf_pages integer,
  downloaded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.curriculum_units (
  id uuid primary key default gen_random_uuid(),
  cycle_id text not null references public.cycles (id),
  grade_id smallint not null references public.grades (id),
  subject_id text not null references public.subjects (id),
  area text,                           -- e.g. 'Números' in Matemáticas; null when the program has none
  title text not null,
  term smallint check (term between 1 and 3),  -- optional tag, never assumed (SPEC §7.6)
  learning_outcomes text[] not null default '{}',
  contents text[] not null default '{}',
  -- Provenance is mandatory: document, page and verbatim excerpt (SPEC §4.1).
  source_id uuid not null references public.curriculum_sources (id),
  source_page integer not null check (source_page > 0),
  source_excerpt text not null check (char_length(source_excerpt) > 0),
  status public.unit_status not null default 'draft',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  sort_order integer not null default 0,
  extraction_meta jsonb not null default '{}',  -- model, prompt id/version, run id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index curriculum_units_lookup_idx
  on public.curriculum_units (cycle_id, grade_id, subject_id, status);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.curriculum_units (id) on delete cascade,
  subject_id text not null references public.subjects (id),
  grade_id smallint not null references public.grades (id),
  code text,                           -- numbering in the official document, e.g. '1.1'
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index skills_unit_idx on public.skills (unit_id);

-- Prerequisites may point to skills of earlier grades (future I/II Ciclo hook, SPEC §9).
create table public.skill_prerequisites (
  skill_id uuid not null references public.skills (id) on delete cascade,
  prerequisite_id uuid not null references public.skills (id) on delete cascade,
  primary key (skill_id, prerequisite_id),
  check (skill_id <> prerequisite_id)
);

create table public.review_log (
  id bigint generated always as identity primary key,
  entity_type text not null,           -- 'unit', 'skill', 'material', 'item'
  entity_id uuid not null,
  action text not null,                -- 'edit', 'approve', 'publish', 'reject'
  actor_id uuid not null references public.profiles (id),
  diff jsonb,
  created_at timestamptz not null default now()
);
create index review_log_entity_idx on public.review_log (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Study material and item bank
-- ---------------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.curriculum_units (id) on delete cascade,
  kind public.material_kind not null,
  content text not null,               -- Markdown
  version integer not null default 1,
  status public.content_status not null default 'draft',
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  model text,
  prompt_id text,
  prompt_version text,
  created_at timestamptz not null default now()
);
create index materials_unit_idx on public.materials (unit_id, kind, status);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.curriculum_units (id) on delete cascade,
  skill_ids uuid[] not null default '{}',
  kind public.item_kind not null default 'single_choice',
  stem text not null,
  options text[],
  correct_index smallint,
  explanation text,
  distractor_explanations text[],      -- why each wrong option is wrong, aligned with options
  difficulty smallint not null check (difficulty between 1 and 5),
  verified boolean not null default false,
  verification jsonb not null default '{}',
  status public.content_status not null default 'draft',
  origin public.item_origin not null default 'bulk',
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  model text,
  prompt_id text,
  prompt_version text,
  created_at timestamptz not null default now(),
  -- Default format: stem + four options, exactly one correct (product decision, SPEC §8).
  constraint single_choice_shape check (
    kind <> 'single_choice'
    or (cardinality(options) = 4 and correct_index between 0 and 3)
  ),
  constraint open_writing_shape check (
    kind <> 'open_writing' or (options is null and correct_index is null)
  )
);
create index items_unit_idx on public.items (unit_id, status, verified, difficulty);

-- ---------------------------------------------------------------------------
-- Learning activity
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  context public.attempt_context not null default 'practice',
  diagnostic_id uuid,
  answer_index smallint,
  answer_text text,
  is_correct boolean,
  time_ms integer check (time_ms >= 0),
  hints_used smallint not null default 0 check (hints_used >= 0),
  session_id uuid,
  created_at timestamptz not null default now()
);
create index attempts_student_idx on public.attempts (student_id, created_at desc);

create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  subject_id text not null references public.subjects (id),
  grade_id smallint not null references public.grades (id),
  status public.diagnostic_status not null default 'in_progress',
  estimated_level numeric,
  skill_detail jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index diagnostics_student_idx on public.diagnostics (student_id, subject_id);

alter table public.attempts
  add constraint attempts_diagnostic_fk
  foreign key (diagnostic_id) references public.diagnostics (id) on delete cascade;

create table public.mastery (
  student_id uuid not null references public.students (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  score numeric not null check (score between 0 and 1),
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

create table public.tutor_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  unit_id uuid references public.curriculum_units (id) on delete set null,
  topic text,                          -- teachers see only this, never the transcript
  message_count integer not null default 0,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index tutor_sessions_student_idx on public.tutor_sessions (student_id);

create table public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tutor_sessions (id) on delete cascade,
  role public.tutor_role not null,
  content text not null,
  safety_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index tutor_messages_session_idx on public.tutor_messages (session_id, created_at);
create index tutor_messages_created_idx on public.tutor_messages (created_at);

-- Only categories and counts; the student's text is not stored (SPEC §6).
create table public.writing_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  unit_id uuid references public.curriculum_units (id) on delete set null,
  category text not null,              -- 'tildes', 'b_v', 'c_s_z', 'h', 'g_j', 'mayusculas', 'puntuacion', 'concordancia', 'cohesion'
  count integer not null check (count >= 0),
  created_at timestamptz not null default now()
);
create index writing_feedback_student_idx on public.writing_feedback (student_id);

-- ---------------------------------------------------------------------------
-- Feedback, observability, limits, audit
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type public.report_target not null,
  target_id uuid not null,
  comment text check (char_length(comment) <= 2000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  purpose text not null,               -- 'tutor', 'bulk_material', 'verify', 'structure', 'teacher_summary'
  input_tokens integer,
  output_tokens integer,
  cost_usd_estimate numeric,
  latency_ms integer,
  success boolean not null,
  error text,
  actor_id uuid,                       -- anonymous student / teacher id, never a name
  section_id uuid
);
create index ai_usage_created_idx on public.ai_usage (created_at desc);

create table public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) <= 64),
  props jsonb not null default '{}'
);

-- Fixed-window counters for rate limiting (serverless memory is not reliable, SPEC §15).
create table public.quota_counters (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

create table public.teacher_audit_log (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,                -- 'view_section', 'view_student', 'export_csv', 'remove_student'
  section_id uuid,
  student_id uuid,
  created_at timestamptz not null default now()
);
