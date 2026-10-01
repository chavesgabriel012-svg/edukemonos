import type pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { type Fixture, ids, loadFixture } from "./fixtures";
import { anon, as, connect, expectDenied, service, user } from "./helpers";

let db: pg.Client;
let fx: Fixture;

const s1 = user(ids.student1);
const s2 = user(ids.student2);
const loner = user(ids.loner);
const t1 = user(ids.teacher1);
const t2 = user(ids.teacher2);
const reviewer = user(ids.reviewer);
const admin = user(ids.admin);

beforeAll(async () => {
  db = await connect(inject("databaseUrl"));
  fx = await loadFixture(db);
});

afterAll(async () => {
  await db.end();
});

const count = (rows: unknown[]) => rows.length;

describe("accounts and roles", () => {
  it("creates a teacher profile for email sign-ups but never for anonymous students", async () => {
    const rows = await db.query(`select id, role from public.profiles where id = any($1)`, [
      [ids.teacher1, ids.student1],
    ]);
    expect(rows.rows).toEqual([{ id: ids.teacher1, role: "teacher" }]);
  });

  it("does not let a teacher promote themselves to admin", async () => {
    await expectDenied(db, t1, `update public.profiles set role = 'admin' where id = $1`, [ids.teacher1], /permission denied/);
  });

  it("lets a teacher edit only their own display name", async () => {
    const own = await as(db, t1, `update public.profiles set display_name = 'Prof' where id = $1 returning id`, [ids.teacher1]);
    expect(count(own)).toBe(1);
    const other = await as(db, t1, `update public.profiles set display_name = 'X' where id = $1 returning id`, [ids.teacher2]);
    expect(count(other)).toBe(0);
  });

  it("does not let anyone insert profiles through the API", async () => {
    await expectDenied(db, s1, `insert into public.profiles (id, role) values ($1, 'admin')`, [ids.student1]);
  });

  it("hides other users' profiles", async () => {
    expect(count(await as(db, t1, `select id from public.profiles`))).toBe(1);
    expect(count(await as(db, admin, `select id from public.profiles`))).toBe(4);
  });
});

describe("students only see their own data", () => {
  it.each([
    ["attempts", "student_id"],
    ["mastery", "student_id"],
    ["diagnostics", "student_id"],
    ["tutor_sessions", "student_id"],
    ["writing_feedback", "student_id"],
  ])("%s", async (table, column) => {
    const rows = await as<{ owner: string }>(db, s1, `select ${column} as owner from public.${table}`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.owner === ids.student1)).toBe(true);
  });

  it("cannot read another student's tutor transcript", async () => {
    const rows = await as<{ content: string }>(db, s1, `select content from public.tutor_messages`);
    expect(rows.map((r) => r.content)).toEqual(["mensaje privado uno"]);
  });

  it("cannot read the names of classmates", async () => {
    const rows = await as<{ student_id: string }>(db, s1, `select student_id from public.section_members`);
    expect(rows.map((r) => r.student_id)).toEqual([ids.student1]);
  });

  it("cannot see sections they do not belong to", async () => {
    const rows = await as<{ id: string }>(db, s1, `select id from public.sections`);
    expect(rows.map((r) => r.id)).toEqual([ids.section1]);
  });

  it("cannot forge learning records directly", async () => {
    await expectDenied(db, s1, `insert into public.attempts (student_id, item_id, is_correct) values ($1, $2, true)`, [ids.student1, ids.itemVerified]);
    await expectDenied(db, s1, `insert into public.mastery (student_id, skill_id, score) values ($1, $2, 1)`, [ids.student1, ids.skillPublished]);
    await expectDenied(db, s1, `update public.mastery set score = 1 where student_id = $1`, [ids.student1]);
    await expectDenied(db, s1, `insert into public.tutor_messages (session_id, role, content) values ($1, 'assistant', 'x')`, [ids.tutorSession1]);
    await expectDenied(db, s1, `update public.diagnostics set status = 'completed' where id = $1`, [ids.diagnostic1]);
  });

  it("cannot create a diagnostic or student row for someone else", async () => {
    await expectDenied(db, s1, `insert into public.diagnostics (student_id, subject_id, grade_id) values ($1, 'matematicas', 7)`, [ids.student2], /row-level security/);
    await expectDenied(db, s1, `insert into public.students (id) values ($1)`, ["00000000-0000-4000-8000-00000000ffff"], /row-level security/);
  });

  it("cannot create sections", async () => {
    await expectDenied(db, s1, `insert into public.sections (teacher_id, name, grade_id) values ($1, 'falsa', 7)`, [ids.student1], /row-level security/);
  });

  it("cannot join a section by inserting membership directly", async () => {
    await expectDenied(db, loner, `insert into public.section_members (section_id, student_id, display_name, consent_at) values ($1, $2, 'x', now())`, [ids.section1, ids.loner]);
  });
});

describe("joining a section", () => {
  const join = `select * from public.join_section($1, $2, $3)`;

  it("works with code, name and consent", async () => {
    const rows = await as<{ section_id: string }>(db, loner, join, [fx.joinCode1, "Nuevo Sintético", true]);
    expect(rows[0].section_id).toBe(ids.section1);
  });

  it("accepts the code with dashes and lowercase", async () => {
    const pretty = `${fx.joinCode1.slice(0, 3)}-${fx.joinCode1.slice(3)}`.toLowerCase();
    const rows = await as<{ section_id: string }>(db, loner, join, [pretty, "Nuevo", true]);
    expect(rows[0].section_id).toBe(ids.section1);
  });

  it("requires consent", async () => {
    await expectDenied(db, loner, join, [fx.joinCode1, "Nuevo", false], /consent/);
  });

  it("rejects wrong codes and empty names", async () => {
    await expectDenied(db, loner, join, ["ZZZZZZ", "Nuevo", true], /invalid or inactive code/);
    await expectDenied(db, loner, join, [fx.joinCode1, "   ", true], /invalid display name/);
  });

  it("rejects inactive sections", async () => {
    await db.query(`update public.sections set active = false where id = $1`, [ids.section2]);
    try {
      await expectDenied(db, loner, join, [fx.joinCode2, "Nuevo", true], /invalid or inactive code/);
    } finally {
      await db.query(`update public.sections set active = true where id = $1`, [ids.section2]);
    }
  });

  it("is not available to anonymous visitors without a session or to staff", async () => {
    await expectDenied(db, anon, join, [fx.joinCode1, "Nuevo", true], /permission denied/);
    await expectDenied(db, t2, join, [fx.joinCode1, "Nuevo", true], /staff accounts/);
  });
});

describe("teachers only see their own sections and members", () => {
  it("sees own section members, not other sections", async () => {
    const rows = await as<{ student_id: string }>(db, t1, `select student_id from public.section_members order by student_id`);
    expect(rows.map((r) => r.student_id)).toEqual([ids.student1, ids.student1b]);
    expect(await as(db, t1, `select id from public.sections where id = $1`, [ids.section2])).toEqual([]);
  });

  it("sees learning data of own students only", async () => {
    for (const table of ["attempts", "mastery", "tutor_sessions", "writing_feedback", "diagnostics"]) {
      const rows = await as<{ student_id: string }>(db, t1, `select student_id from public.${table}`);
      expect(rows.every((r) => r.student_id === ids.student1), table).toBe(true);
    }
  });

  it("sees tutor topics but never transcripts", async () => {
    const topics = await as<{ topic: string }>(db, t1, `select topic from public.tutor_sessions`);
    expect(topics.map((r) => r.topic)).toEqual(["potencias"]);
    expect(await as(db, t1, `select content from public.tutor_messages`)).toEqual([]);
  });

  it("cannot modify or delete another teacher's section", async () => {
    expect(await as(db, t1, `update public.sections set name = 'x' where id = $1 returning id`, [ids.section2])).toEqual([]);
    expect(await as(db, t1, `delete from public.sections where id = $1 returning id`, [ids.section2])).toEqual([]);
    expect(await as(db, t1, `delete from public.section_members where section_id = $1 returning student_id`, [ids.section2])).toEqual([]);
  });

  it("cannot steal a section by changing teacher_id, nor set the join code by hand", async () => {
    await expectDenied(db, t1, `update public.sections set teacher_id = $2 where id = $1`, [ids.section1, ids.teacher2], /teacher_id cannot change/);
    await expectDenied(db, t1, `update public.sections set join_code = 'AAAAAA' where id = $1`, [ids.section1], /regenerate_join_code/);
  });

  it("can regenerate own code but not someone else's", async () => {
    const [{ code }] = await as<{ code: string }>(db, t1, `select public.regenerate_join_code($1) as code`, [ids.section1]);
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    expect(code).not.toBe(fx.joinCode1);
    await expectDenied(db, t1, `select public.regenerate_join_code($1)`, [ids.section2], /not your section/);
  });

  it("can create a section for themselves only, with a generated code", async () => {
    const [row] = await as<{ join_code: string }>(db, t1, `insert into public.sections (teacher_id, name, grade_id, join_code) values ($1, 'nueva', 8, 'AAAAAA') returning join_code`, [ids.teacher1]);
    expect(row.join_code).not.toBe("AAAAAA");
    await expectDenied(db, t1, `insert into public.sections (teacher_id, name, grade_id) values ($1, 'ajena', 8)`, [ids.teacher2], /row-level security/);
  });

  it("can remove a student from own section", async () => {
    const rows = await as(db, t1, `delete from public.section_members where section_id = $1 and student_id = $2 returning student_id`, [ids.section1, ids.student1b]);
    expect(count(rows)).toBe(1);
  });

  it("cannot read AI usage, reports or analytics", async () => {
    expect(await as(db, t1, `select id from public.ai_usage`)).toEqual([]);
    expect(await as(db, t1, `select id from public.reports`)).toEqual([]);
    expect(await as(db, t1, `select id from public.events`)).toEqual([]);
  });

  it("can only write audit entries as themselves", async () => {
    expect(count(await as(db, t1, `insert into public.teacher_audit_log (teacher_id, action, section_id) values ($1, 'view_section', $2) returning id`, [ids.teacher1, ids.section1]))).toBe(1);
    await expectDenied(db, t1, `insert into public.teacher_audit_log (teacher_id, action) values ($1, 'view_section')`, [ids.teacher2], /row-level security/);
    await expectDenied(db, s1, `insert into public.teacher_audit_log (teacher_id, action) values ($1, 'view_section')`, [ids.student1], /row-level security/);
  });
});

describe("curriculum and content", () => {
  it("anonymous visitors read only published units, skills and materials", async () => {
    expect((await as<{ id: string }>(db, anon, `select id from public.curriculum_units`)).map((r) => r.id)).toEqual([ids.unitPublished]);
    expect((await as<{ id: string }>(db, anon, `select id from public.skills`)).map((r) => r.id)).toEqual([ids.skillPublished]);
    expect((await as<{ id: string }>(db, anon, `select id from public.materials`)).map((r) => r.id)).toEqual([ids.materialPublished]);
  });

  it("hides items on draft units and draft items", async () => {
    const rows = await as<{ id: string }>(db, anon, `select id from public.items order by id`);
    expect(rows.map((r) => r.id)).toEqual([ids.itemVerified, ids.itemUnverified]);
  });

  it("never exposes the answer key through the API", async () => {
    await expectDenied(db, s1, `select correct_index from public.items`, [], /permission denied/);
    await expectDenied(db, anon, `select * from public.items`, [], /permission denied/);
    await expectDenied(db, s1, `select explanation from public.items`, [], /permission denied/);
  });

  it("only reviewers/admins write curriculum content", async () => {
    expect(await as(db, t1, `update public.curriculum_units set status = 'published' where id = $1 returning id`, [ids.unitDraft])).toEqual([]);
    await expectDenied(db, s1, `insert into public.materials (unit_id, kind, content, status) values ($1, 'summary', 'falso', 'published')`, [ids.unitPublished], /row-level security/);
    expect(count(await as(db, reviewer, `update public.curriculum_units set status = 'published' where id = $1 returning id`, [ids.unitDraft]))).toBe(1);
    expect(count(await as(db, reviewer, `select id from public.curriculum_units`))).toBe(2);
  });

  it("only accepts official MEP study programs as curriculum sources", async () => {
    await expectDenied(db, service, `insert into public.curriculum_sources (source_key, kind, subject_id, cycle_id, title, url) values ('t1', 'spec_table', 'matematicas', 'III', 'x', 'https://www.mep.go.cr/x.pdf')`, [], /curriculum_sources_programs_only/);
    await expectDenied(db, service, `insert into public.curriculum_sources (source_key, kind, subject_id, cycle_id, title, url) values ('t2', 'program', 'matematicas', 'III', 'x', 'https://dgec.mep.go.cr/x.pdf')`, [], /curriculum_sources_programs_only/);
  });

  it("only admins delete units", async () => {
    expect(await as(db, reviewer, `delete from public.curriculum_units where id = $1 returning id`, [ids.unitDraft])).toEqual([]);
  });

  it("review log cannot be forged or rewritten", async () => {
    await expectDenied(db, reviewer, `insert into public.review_log (entity_type, entity_id, action, actor_id) values ('unit', $1, 'publish', $2)`, [ids.unitDraft, ids.admin], /row-level security/);
    expect(count(await as(db, reviewer, `insert into public.review_log (entity_type, entity_id, action, actor_id) values ('unit', $1, 'publish', $2) returning id`, [ids.unitDraft, ids.reviewer]))).toBe(1);
    await expectDenied(db, reviewer, `delete from public.review_log`, [], /permission denied/);
  });
});

describe("grading through submit_attempt", () => {
  const submit = `select public.submit_attempt($1, $2::smallint, null, 1000, 0::smallint, null, $3::public.attempt_context, $4) as r`;

  it("grades on the server and returns the explanation", async () => {
    const [{ r }] = await as<{ r: { is_correct: boolean; correct_index: number } }>(db, s1, submit, [ids.itemVerified, 2, "practice", null]);
    expect(r.is_correct).toBe(true);
    expect(r.correct_index).toBe(2);
  });

  it("refuses unpublished items and items on draft units", async () => {
    await expectDenied(db, s1, submit, [ids.itemDraft, 0, "practice", null], /item not available/);
    await expectDenied(db, s1, submit, [ids.itemOnDraftUnit, 0, "practice", null], /item not available/);
  });

  it("refuses unverified items in diagnostics", async () => {
    await expectDenied(db, s1, submit, [ids.itemUnverified, 1, "diagnostic", ids.diagnostic1], /unverified/);
  });

  it("refuses to attach attempts to another student's diagnostic", async () => {
    await expectDenied(db, s2, submit, [ids.itemVerified, 2, "diagnostic", ids.diagnostic1], /invalid diagnostic/);
  });

  it("is not callable without a session", async () => {
    await expectDenied(db, anon, submit, [ids.itemVerified, 2, "practice", null], /permission denied/);
  });
});

describe("reports, analytics and quotas", () => {
  it("anyone can report an error, but not on behalf of someone else", async () => {
    // No RETURNING: reporters cannot read reports back, so the app must insert without `.select()`.
    await as(db, s1, `insert into public.reports (reporter_id, target_type, target_id, comment) values ($1, 'item', $2, 'mal')`, [ids.student1, ids.itemVerified]);
    await as(db, anon, `insert into public.reports (target_type, target_id) values ('item', $1)`, [ids.itemVerified]);
    await expectDenied(db, s1, `insert into public.reports (reporter_id, target_type, target_id) values ($1, 'item', $2) returning id`, [ids.student1, ids.itemVerified], /row-level security/);
    await expectDenied(db, s1, `insert into public.reports (reporter_id, target_type, target_id) values ($1, 'item', $2)`, [ids.student2, ids.itemVerified], /row-level security/);
    await expectDenied(db, s1, `insert into public.reports (reporter_id, target_type, target_id, status) values ($1, 'item', $2, 'resolved')`, [ids.student1, ids.itemVerified], /row-level security/);
  });

  it("only reviewers read reports", async () => {
    expect(await as(db, s1, `select id from public.reports`)).toEqual([]);
    expect(count(await as(db, reviewer, `select id from public.reports`))).toBe(1);
  });

  it("events can only be logged as yourself", async () => {
    await expectDenied(db, s1, `insert into public.events (actor_id, name) values ($1, 'x')`, [ids.student2], /row-level security/);
  });

  it("only admins read AI usage", async () => {
    expect(count(await as(db, admin, `select id from public.ai_usage`))).toBe(1);
    await expectDenied(db, s1, `insert into public.ai_usage (provider, model, purpose, success) values ('x','x','x',true)`, [], /permission denied/);
  });

  it("quota counters are server-only and enforce the limit", async () => {
    await expectDenied(db, s1, `select public.consume_quota('k', 1, 60)`, [], /permission denied/);
    await expectDenied(db, s1, `select * from public.quota_counters`, [], /permission denied/);
    await db.query("begin");
    try {
      await db.query("set local role service_role");
      const results: boolean[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await db.query<{ ok: boolean }>(`select public.consume_quota('test:device', 2, 3600) as ok`);
        results.push(r.rows[0].ok);
      }
      expect(results).toEqual([true, true, false]);
    } finally {
      await db.query("rollback");
    }
  });

  it("retention purge is server-only", async () => {
    await expectDenied(db, s1, `select public.purge_expired_tutor_messages(30)`, [], /permission denied/);
    expect(await as(db, service, `select public.purge_expired_tutor_messages(30) as n`)).toEqual([{ n: 0 }]);
  });
});
