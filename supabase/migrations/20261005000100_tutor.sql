-- Phase 4: the tutor.

-- Prompt-cache tokens apart from input tokens, so /admin can show real costs (cache reads are
-- billed at 0.1× and 5-minute writes at 1.25× the input price; cost_usd_estimate already applies it).
alter table public.ai_usage add column cache_read_tokens integer;
alter table public.ai_usage add column cache_write_tokens integer;

-- Daily tutor counts per student are read often by the route that enforces limits.
create index if not exists tutor_sessions_student_started_idx on public.tutor_sessions (student_id, started_at desc);
