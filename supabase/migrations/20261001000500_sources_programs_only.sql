-- Curriculum sources are official study programs only (founder decision, 2026-10-01).
-- Educación Abierta (DGEC) specification tables and practice tests are excluded, so the
-- generators and the tutor have a single kind of source. The enum keeps its old values
-- (Postgres cannot drop enum values safely); this constraint is what enforces the rule.
alter table public.curriculum_sources
  add constraint curriculum_sources_programs_only
  check (kind = 'program' and url like 'https://www.mep.go.cr/%');
