-- Row Level Security. Principles (SPEC §6):
--   * A student only sees their own data.
--   * A teacher only sees their own sections and those sections' members.
--   * Published content is public to read; only reviewer/admin can write it.
-- Writes that need validation (joining a section, grading an attempt) go through RPCs.
-- service_role bypasses RLS and is used only by trusted server code and batch jobs.

alter table public.cycles enable row level security;
alter table public.grades enable row level security;
alter table public.subjects enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.sections enable row level security;
alter table public.section_members enable row level security;
alter table public.curriculum_sources enable row level security;
alter table public.curriculum_units enable row level security;
alter table public.skills enable row level security;
alter table public.skill_prerequisites enable row level security;
alter table public.review_log enable row level security;
alter table public.materials enable row level security;
alter table public.items enable row level security;
alter table public.attempts enable row level security;
alter table public.diagnostics enable row level security;
alter table public.mastery enable row level security;
alter table public.tutor_sessions enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.writing_feedback enable row level security;
alter table public.reports enable row level security;
alter table public.ai_usage enable row level security;
alter table public.events enable row level security;
alter table public.quota_counters enable row level security;
alter table public.teacher_audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Catalog: public read, admin write
-- ---------------------------------------------------------------------------
create policy cycles_read on public.cycles for select to anon, authenticated using (true);
create policy cycles_admin on public.cycles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy grades_read on public.grades for select to anon, authenticated using (true);
create policy grades_admin on public.grades for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy subjects_read on public.subjects for select to anon, authenticated using (true);
create policy subjects_admin on public.subjects for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Profiles: own row; only display_name is user-editable (no self-promotion of role)
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create policy students_select on public.students for select to authenticated
  using (id = (select auth.uid()) or private.teaches_student(id));
create policy students_insert_own on public.students for insert to authenticated
  with check (id = (select auth.uid()) and not private.is_staff());
create policy students_update_own on public.students for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.students from anon, authenticated;
grant update (declared_grade_id) on public.students to authenticated;

-- ---------------------------------------------------------------------------
-- Sections and members
-- ---------------------------------------------------------------------------
create policy sections_teacher_select on public.sections for select to authenticated
  using (teacher_id = (select auth.uid()) or private.is_section_member(id));
create policy sections_teacher_insert on public.sections for insert to authenticated
  with check (teacher_id = (select auth.uid()) and private.is_staff());
create policy sections_teacher_update on public.sections for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy sections_teacher_delete on public.sections for delete to authenticated
  using (teacher_id = (select auth.uid()));

-- Inserts only through join_section(); no direct insert/update policy.
create policy members_select on public.section_members for select to authenticated
  using (student_id = (select auth.uid()) or private.owns_section(section_id));
create policy members_delete_by_teacher on public.section_members for delete to authenticated
  using (private.owns_section(section_id));
create policy members_delete_self on public.section_members for delete to authenticated
  using (student_id = (select auth.uid()));
revoke insert, update on public.section_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Curriculum (sources metadata is public so pages can cite them)
-- ---------------------------------------------------------------------------
create policy sources_read on public.curriculum_sources for select to anon, authenticated using (true);
create policy sources_write on public.curriculum_sources for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy units_read_published on public.curriculum_units for select to anon, authenticated
  using (status = 'published' or private.is_reviewer());
create policy units_insert on public.curriculum_units for insert to authenticated
  with check (private.is_reviewer());
create policy units_update on public.curriculum_units for update to authenticated
  using (private.is_reviewer()) with check (private.is_reviewer());
create policy units_delete on public.curriculum_units for delete to authenticated
  using (private.is_admin());

create policy skills_read on public.skills for select to anon, authenticated
  using (private.unit_is_published(unit_id) or private.is_reviewer());
create policy skills_write on public.skills for all to authenticated
  using (private.is_reviewer()) with check (private.is_reviewer());

create policy skill_prereq_read on public.skill_prerequisites for select to anon, authenticated using (true);
create policy skill_prereq_write on public.skill_prerequisites for all to authenticated
  using (private.is_reviewer()) with check (private.is_reviewer());

create policy review_log_read on public.review_log for select to authenticated
  using (private.is_reviewer());
create policy review_log_insert on public.review_log for insert to authenticated
  with check (private.is_reviewer() and actor_id = (select auth.uid()));
revoke update, delete on public.review_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Materials and items
-- ---------------------------------------------------------------------------
create policy materials_read on public.materials for select to anon, authenticated
  using ((status = 'published' and private.unit_is_published(unit_id)) or private.is_reviewer());
create policy materials_write on public.materials for all to authenticated
  using (private.is_reviewer()) with check (private.is_reviewer());

create policy items_read on public.items for select to anon, authenticated
  using ((status = 'published' and private.unit_is_published(unit_id)) or private.is_reviewer());
create policy items_write on public.items for all to authenticated
  using (private.is_reviewer()) with check (private.is_reviewer());
-- Answer key columns are hidden from API roles; grading happens in submit_attempt().
-- Reviewers read the full item through server code using service_role.
revoke select on public.items from anon, authenticated;
grant select (id, unit_id, skill_ids, kind, stem, options, difficulty, verified, status, origin,
              reviewer_id, reviewed_at, created_at)
  on public.items to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Learning activity: own rows for students, read-only for their teachers
-- ---------------------------------------------------------------------------
create policy attempts_select on public.attempts for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches_student(student_id));
revoke insert, update, delete on public.attempts from anon, authenticated;

create policy diagnostics_select on public.diagnostics for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches_student(student_id));
create policy diagnostics_insert_own on public.diagnostics for insert to authenticated
  with check (student_id = (select auth.uid()) and status = 'in_progress');
revoke update, delete on public.diagnostics from anon, authenticated;

create policy mastery_select on public.mastery for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches_student(student_id));
revoke insert, update, delete on public.mastery from anon, authenticated;

-- Teachers see session topics, never transcripts.
create policy tutor_sessions_select on public.tutor_sessions for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches_student(student_id));
revoke insert, update, delete on public.tutor_sessions from anon, authenticated;

create policy tutor_messages_select_own on public.tutor_messages for select to authenticated
  using (private.owns_tutor_session(session_id));
revoke insert, update, delete on public.tutor_messages from anon, authenticated;

create policy writing_feedback_select on public.writing_feedback for select to authenticated
  using (student_id = (select auth.uid()) or private.teaches_student(student_id));
revoke insert, update, delete on public.writing_feedback from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reports, analytics, usage, limits, audit
-- ---------------------------------------------------------------------------
create policy reports_insert on public.reports for insert to anon, authenticated
  with check (reporter_id is not distinct from (select auth.uid()) and status = 'open');
create policy reports_read on public.reports for select to authenticated
  using (private.is_reviewer());
create policy reports_update on public.reports for update to authenticated
  using (private.is_reviewer()) with check (private.is_reviewer());

create policy events_insert_own on public.events for insert to authenticated
  with check (actor_id = (select auth.uid()));
create policy events_admin_read on public.events for select to authenticated
  using (private.is_admin());

create policy ai_usage_admin_read on public.ai_usage for select to authenticated
  using (private.is_admin());
revoke insert, update, delete on public.ai_usage from anon, authenticated;

-- quota_counters: no policies => no API access at all (service_role only).
revoke all on public.quota_counters from anon, authenticated;

create policy audit_read on public.teacher_audit_log for select to authenticated
  using (teacher_id = (select auth.uid()) or private.is_admin());
create policy audit_insert_own on public.teacher_audit_log for insert to authenticated
  with check (teacher_id = (select auth.uid()) and private.is_staff());
revoke update, delete on public.teacher_audit_log from anon, authenticated;
