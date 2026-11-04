import type pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { type Fixture, ids, loadFixture } from "./fixtures";
import { addWeeks, classDays, computeStreak, estimateAbility, goalTarget, isSafeNickname, leaderboardWindow, levelOf, MEP_2027, NICKNAME_ADJECTIVES, NICKNAME_NOUNS, updateMastery, weekStartCR } from "@edukemonos/curriculum";
import { anon, as, asActors, asSteps, connect, expectDenied, service, user } from "./helpers";

let db: pg.Client;
let fx: Fixture;

const s1 = user(ids.student1);
const s1b = user(ids.student1b);
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

  it("gives answer keys only to reviewers, through review_items()", async () => {
    await expectDenied(db, s1, `select * from public.review_items($1)`, [ids.unitPublished], /only reviewers/);
    await expectDenied(db, t1, `select * from public.review_items($1)`, [ids.unitPublished], /only reviewers/);
    await expectDenied(db, anon, `select * from public.review_items($1)`, [ids.unitPublished], /permission denied/);
    const rows = await as<{ id: string; correct_index: number }>(
      db, reviewer, `select id, correct_index from public.review_items($1) order by id`, [ids.unitPublished],
    );
    expect(rows.map((r) => r.id)).toContain(ids.itemVerified);
    expect(rows.every((r) => typeof r.correct_index === "number")).toBe(true);
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

  it("page texts of the official documents are visible to reviewers only", async () => {
    await db.query(`insert into public.curriculum_pages (source_id, page, text, extracted_with) values ($1, 10, 'texto', 'test')`, [ids.source]);
    try {
      await expectDenied(db, anon, `select * from public.curriculum_pages`, [], /permission denied/);
      expect(await as(db, s1, `select page from public.curriculum_pages`)).toEqual([]);
      expect(await as(db, t1, `select page from public.curriculum_pages`)).toEqual([]);
      expect(await as(db, reviewer, `select page from public.curriculum_pages`)).toEqual([{ page: 10 }]);
      await expectDenied(db, reviewer, `insert into public.curriculum_pages (source_id, page, text, extracted_with) values ($1, 11, 'x', 'x')`, [ids.source], /row-level security/);
    } finally {
      await db.query(`delete from public.curriculum_pages`);
    }
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

describe("mastery and the adaptive diagnostic", () => {
  const submit = `select public.submit_attempt($1, $2::smallint, null, 1000, 0::smallint, null, $3::public.attempt_context, $4) as r`;
  const masteryOf = [`select score::float8 as score, attempts from public.mastery where skill_id = $1`, [ids.skillPublished]] as [string, unknown[]];

  it("computes mastery exactly like the TypeScript reference", async () => {
    const seq: [number, boolean][] = [[3, true], [4, true], [4, false], [2, true], [5, false]];
    let ts: number | null = null;
    let score: number | null = null;
    for (const [n, [d, c]] of seq.entries()) {
      const result: pg.QueryResult<{ v: number }> = await db.query(`select private.mastery_after($1, $2, $3, $4)::float8 as v`, [score, n, d, c]);
      const v: number = result.rows[0].v;
      ts = updateMastery(ts, n, d, c);
      expect(v).toBeCloseTo(ts, 10);
      score = v;
    }
    const diffs = [3, 4, 3, 4, 5, 2];
    const oks = [true, false, true, true, false, true];
    const [{ t }] = (await db.query(`select private.estimate_ability($1, $2) as t`, [diffs, oks])).rows;
    expect(t).toBeCloseTo(estimateAbility(diffs.map((difficulty, i) => ({ difficulty, correct: oks[i] }))), 8);
  });

  it("updates the student's mastery of the item's skills on each graded answer", async () => {
    // student2 starts at 0.3 with 0 recorded attempts (fixture); a right answer at difficulty 3 raises it.
    const [, rows] = await asSteps(db, s2, [[submit, [ids.itemVerified, 2, "practice", null]], masteryOf]);
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBeCloseTo(updateMastery(0.3, 0, 3, true), 6);
    expect(rows[0].attempts).toBe(1);
  });

  it("starts a diagnostic, refuses a repeated item and closes it with a level and skill detail", async () => {
    const [[{ id }]] = await asSteps(db, s1b, [[`select public.start_diagnostic('matematicas', 7::smallint) as id`]]);
    expect(id).toBeTruthy();
    const steps = await asSteps(db, s1b, [
      [`select public.start_diagnostic('matematicas', 7::smallint) as id`],
      [`select public.submit_attempt($1, 2::smallint, null, 1000, 0::smallint, null, 'diagnostic', (select id from public.diagnostics where status = 'in_progress' and student_id = $2)) as r`, [ids.itemVerified, ids.student1b]],
      [`select public.finish_diagnostic((select id from public.diagnostics where status = 'in_progress' and student_id = $1)) as r`, [ids.student1b]],
      [`select status, estimated_level::float8 as level, skill_detail from public.diagnostics where student_id = $1 and status = 'completed'`, [ids.student1b]],
    ]);
    const finished = steps[2][0].r as { status: string; level: number; answered: number; correct: number };
    expect(finished).toMatchObject({ status: "completed", answered: 1, correct: 1 });
    expect(finished.level).toBeCloseTo(levelOf(estimateAbility([{ difficulty: 3, correct: true }])), 1);
    expect(Object.keys(steps[3][0].skill_detail)).toEqual([ids.skillPublished]);

    await expect(
      asSteps(db, s1b, [
        [`select public.start_diagnostic('matematicas', 7::smallint) as id`],
        [`select public.submit_attempt($1, 2::smallint, null, 1000, 0::smallint, null, 'diagnostic', (select id from public.diagnostics where status = 'in_progress' and student_id = $2))`, [ids.itemVerified, ids.student1b]],
        [`select public.submit_attempt($1, 2::smallint, null, 1000, 0::smallint, null, 'diagnostic', (select id from public.diagnostics where status = 'in_progress' and student_id = $2))`, [ids.itemVerified, ids.student1b]],
      ]),
    ).rejects.toThrow(/already answered/);
  });

  it("check_answer grades without a session and stores nothing", async () => {
    const before = (await db.query(`select count(*)::int as c from public.attempts`)).rows[0].c;
    const [{ r }] = await as<{ r: { is_correct: boolean; correct_index: number } }>(
      db, anon, `select public.check_answer($1, 2::smallint) as r`, [ids.itemVerified],
    );
    expect(r).toMatchObject({ is_correct: true, correct_index: 2 });
    expect((await db.query(`select count(*)::int as c from public.attempts`)).rows[0].c).toBe(before);
    await expectDenied(db, anon, `select public.check_answer($1, 0::smallint)`, [ids.itemDraft], /item not available/);
    await expectDenied(db, anon, `select public.check_answer($1, 0::smallint)`, [ids.itemOnDraftUnit], /item not available/);
  });

  it("never lets a student write mastery or close someone else's diagnostic", async () => {
    await expectDenied(db, s1, `insert into public.mastery (student_id, skill_id, score) values ($1, $2, 1)`, [ids.student1, ids.skillDraft], /permission denied/);
    await expectDenied(db, s1, `update public.mastery set score = 1 where student_id = $1`, [ids.student1], /permission denied/);
    await expectDenied(db, s2, `select public.finish_diagnostic($1)`, [ids.diagnostic1], /invalid diagnostic/);
    await expectDenied(db, anon, `select public.start_diagnostic('matematicas', 7::smallint)`, [], /permission denied/);
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

  it("AI spend totals are server-only", async () => {
    await expectDenied(db, s1, `select * from public.ai_spend_usd_since(now() - interval '1 day')`, [], /permission denied/);
    await expectDenied(db, t1, `select * from public.ai_spend_usd_since(now() - interval '1 day')`, [], /permission denied/);
    const rows = await as<{ spent_usd: string; unpriced_calls: string }>(db, service, `select * from public.ai_spend_usd_since(now() - interval '1 day')`);
    // The fixture's single ai_usage row has no cost: it is reported as an unpriced call.
    expect(rows).toEqual([{ spent_usd: "0", unpriced_calls: "1" }]);
  });

  it("teacher summaries are server-only", async () => {
    const key = "a".repeat(64);
    await expectDenied(db, t1, `select * from public.teacher_summaries`, [], /permission denied/);
    await expectDenied(db, t1, `insert into public.teacher_summaries (key, section_id, summary) values ($1, $2, '{}')`, [key, ids.section1], /permission denied/);
    await expectDenied(db, s1, `select * from public.teacher_summaries`, [], /permission denied/);
    expect(count(await as(db, service, `insert into public.teacher_summaries (key, section_id, summary) values ($1, $2, '{}') returning key`, [key, ids.section1]))).toBe(1);
  });

  it("retention purge is server-only", async () => {
    await expectDenied(db, s1, `select public.purge_expired_tutor_messages(30)`, [], /permission denied/);
    expect(await as(db, service, `select public.purge_expired_tutor_messages(30) as n`)).toEqual([{ n: 0 }]);
  });
});

describe("recovery codes", () => {
  const newDevice = user(ids.newDevice);
  const create = `select public.create_recovery_code() as code`;
  const redeem = `select public.redeem_recovery_code($1) as r`;

  it("creates a readable 12-character code without lookalike characters", async () => {
    const [{ code }] = await as<{ code: string }>(db, s2, create);
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  });

  it("keeps only a hash, which nobody reads through the API", async () => {
    const [[{ code }], rows] = await asSteps(db, s2, [[create], [`select public.has_recovery_code() as has`]]);
    expect(rows[0].has).toBe(true);
    await expectDenied(db, s2, `select * from public.student_recovery_codes`, [], /permission denied/);
    const stored = await asActors(db, [[s2, create], [service, `select code_hash from public.student_recovery_codes where student_id = $1`, [ids.student2]]]);
    expect(stored[1][0]?.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored[1][0]?.code_hash).not.toContain(code.replace(/-/g, ""));
  });

  it("moves all progress to the session on the new device", async () => {
    const codeOf = (prev: { code?: string }[][]) => [prev[0][0].code];
    const [, [{ r }], attempts, mastery, sessions, writing, diagnostics, oldRow, events] = await asActors(db, [
      [s2, create],
      [newDevice, redeem, codeOf],
      [newDevice, `select count(*)::int as n from public.attempts where student_id = $1`, [ids.newDevice]],
      [newDevice, `select score from public.mastery where student_id = $1`, [ids.newDevice]],
      [newDevice, `select topic from public.tutor_sessions where student_id = $1`, [ids.newDevice]],
      [newDevice, `select count(*)::int as n from public.writing_feedback where student_id = $1`, [ids.newDevice]],
      [newDevice, `select count(*)::int as n from public.diagnostics where student_id = $1`, [ids.newDevice]],
      [service, `select count(*)::int as n from public.students where id = $1`, [ids.student2]],
      [service, `select name, props from public.events where actor_id = $1 order by id`, [ids.newDevice]],
    ]);
    expect(r).toMatchObject({ ok: true, already_here: false });
    expect(attempts[0].n).toBe(1);
    expect(mastery.map((m) => Number(m.score))).toEqual([0.3]);
    expect(sessions.map((t) => t.topic)).toEqual(["divisibilidad"]);
    expect(writing[0].n).toBe(1);
    expect(diagnostics[0].n).toBe(1);
    expect(oldRow[0].n).toBe(0);
    // Events carry counts only: no names, no answers.
    expect(events.at(-1)).toMatchObject({ name: "recovery_code_redeemed", props: { moved: { attempts: 1, sections: 1 } } });
  });

  it("keeps the section membership, so the teacher still sees the student", async () => {
    const [, [{ r }], members] = await asActors(db, [
      [s2, create],
      [newDevice, redeem, (prev) => [prev[0][0].code]],
      [t2, `select student_id, display_name from public.section_members where section_id = $1`, [ids.section2]],
    ]);
    expect(r.ok).toBe(true);
    expect(members).toEqual([{ student_id: ids.newDevice, display_name: "Estudiante Sintético Dos" }]);
  });

  it("keeps the record with more attempts when both devices practiced the same skill", async () => {
    await db.query(`update public.mastery set attempts = 9 where student_id = $1`, [ids.student2]);
    await db.query(`insert into public.students (id) values ($1)`, [ids.newDevice]);
    await db.query(`insert into public.mastery (student_id, skill_id, score, attempts) values ($1, $2, 0.9, 2)`, [ids.newDevice, ids.skillPublished]);
    try {
      const [, [{ r }], mastery] = await asActors(db, [
        [s2, create],
        [newDevice, redeem, (prev) => [prev[0][0].code]],
        [newDevice, `select score, attempts from public.mastery where student_id = $1`, [ids.newDevice]],
      ]);
      expect(r.ok).toBe(true);
      expect(mastery.map((m) => [Number(m.score), m.attempts])).toEqual([[0.3, 9]]);
    } finally {
      await db.query(`delete from public.mastery where student_id = $1`, [ids.newDevice]);
      await db.query(`delete from public.students where id = $1`, [ids.newDevice]);
      await db.query(`update public.mastery set attempts = 0 where student_id = $1`, [ids.student2]);
    }
  });

  it("can be used again from the new device, and an old code stops working when a new one is made", async () => {
    const [, , [{ r: withFirst }], [{ r: withSecond }], [{ r: again }]] = await asActors(db, [
      [s2, create],
      [s2, create],
      [newDevice, redeem, (prev) => [prev[0][0].code]],
      [newDevice, redeem, (prev) => [String(prev[1][0].code).toLowerCase().replace(/-/g, " ")]],
      [newDevice, redeem, (prev) => [prev[1][0].code]],
    ]);
    expect(withFirst).toEqual({ ok: false, error: "invalid_code" });
    expect(withSecond).toMatchObject({ ok: true, already_here: false });
    expect(again).toEqual({ ok: true, already_here: true });
  });

  it("limits guesses: failed attempts count, so a code cannot be brute-forced", async () => {
    const guesses = Array.from({ length: 6 }, () => [newDevice, redeem, ["AAAA-BBBB-CCCC"]] as [typeof newDevice, string, unknown[]]);
    const results = await asActors(db, guesses);
    expect(results.slice(0, 5).map(([row]) => row.r.error)).toEqual(Array(5).fill("invalid_code"));
    expect(results[5][0].r).toEqual({ ok: false, error: "rate_limited" });
  });

  it("is not available to visitors without a session or to staff", async () => {
    await expectDenied(db, anon, create, [], /permission denied/);
    await expectDenied(db, anon, redeem, ["AAAA-BBBB-CCCC"], /permission denied/);
    await expectDenied(db, t1, create, [], /staff accounts/);
    await expectDenied(db, t1, redeem, ["AAAA-BBBB-CCCC"], /staff accounts/);
  });

  it("covers every table that belongs to a student", async () => {
    // A new table with a foreign key to students(id) must be added to redeem_recovery_code(), or
    // recovering on another device would leave that progress behind.
    const rows = await as<{ table: string }>(db, service, `
      select distinct c.conrelid::regclass::text as table
      from pg_constraint c
      where c.contype = 'f' and c.confrelid = 'public.students'::regclass
      order by 1`);
    const handled = [
      "attempts", "diagnostics", "mastery", "mastery_weekly", "section_members", "streak_repairs", "student_recovery_codes",
      "tutor_sessions", "writing_feedback",
    ];
    expect(rows.map((r) => r.table.replace(/^public\./, "")).sort()).toEqual(handled);
  });
});

// ---------------------------------------------------------------------------
// Fase 1: institutions, calendars and the weekly mastery streak
// ---------------------------------------------------------------------------

/** Runs a scenario in one transaction that is always rolled back. `act` switches the API role. */
async function scenario<T>(fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResultRow[]>, act: (a: ReturnType<typeof user> | typeof anon | typeof service | null) => Promise<void>) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;
    const act = async (a: ReturnType<typeof user> | typeof anon | typeof service | null) => {
      await db.query("reset role");
      if (!a) return;
      const role = a.kind === "anon" ? "anon" : a.kind === "service" ? "service_role" : "authenticated";
      await db.query(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(a.kind === "user" ? { sub: a.id, role } : { role })]);
    };
    return await fn(q, act);
  } finally {
    await db.query("rollback");
  }
}

/** Creates `n` published items in the published unit and returns their ids (inside a scenario). */
async function makeItems(q: (sql: string, params?: unknown[]) => Promise<pg.QueryResultRow[]>, n: number): Promise<string[]> {
  const rows = await q(
    `insert into public.items (unit_id, stem, options, correct_index, explanation, distractor_explanations, difficulty, verified, status)
     select $1, 'racha ' || g, array['a','b','c','d'], 0, 'e', array['x','x','x','x'], 3, true, 'published' from generate_series(1, $2) g
     returning id`,
    [ids.unitPublished, n],
  );
  return rows.map((r) => r.id as string);
}

/** Right answers to `count` distinct items at a Costa Rica date-time ("2027-03-03 10:00"). */
async function rightAnswers(q: (sql: string, params?: unknown[]) => Promise<pg.QueryResultRow[]>, student: string, items: string[], count: number, crLocal: string) {
  await q(
    `insert into public.attempts (student_id, item_id, is_correct, created_at)
     select $1, i, true, ($3::timestamp + interval '6 hours') at time zone 'UTC' from unnest($2::uuid[]) with ordinality t(i, k) where k <= $4`,
    [student, items, crLocal, count],
  );
}

describe("weekly mastery streak", () => {
  it("matches the TypeScript reference, with the MEP 2027 mid-year break paused", async () => {
    const plan: [string, number][] = [["2027-06-21", 5], ["2027-06-28", 6], ["2027-07-05", 0], ["2027-07-12", 0], ["2027-07-19", 5], ["2027-07-26", 2]];
    const state = await scenario(async (q) => {
      const items = await makeItems(q, 6);
      for (const [week, n] of plan) if (n) await rightAnswers(q, ids.loner, items, n, `${week} 10:00`);
      // A repeated right answer in the same week does not count twice.
      await rightAnswers(q, ids.loner, items, 2, "2027-07-27 09:00");
      const [{ s }] = await q(`select private.streak_state($1, '2027-07-28 18:00Z') as s`, [ids.loner]);
      return s;
    });
    const ref = computeStreak(
      plan.map(([week, count]) => ({ week, count, paused: classDays(MEP_2027, week) === 0, repaired: false })),
      5,
      weekStartCR(new Date("2027-07-28T18:00:00Z")),
    );
    expect(ref).toMatchObject({ current: 3, record: 3, weekCount: 2, paused: false });
    expect(state).toMatchObject({ current: ref.current, record: ref.record, week_count: ref.weekCount, week_done: false, paused: false, broken: false, target: 5 });
  });

  it("pauses during a vacation week", async () => {
    const state = await scenario(async (q) => {
      const items = await makeItems(q, 5);
      await rightAnswers(q, ids.loner, items, 5, "2027-06-29 10:00");
      const [{ s }] = await q(`select private.streak_state($1, '2027-07-07 18:00Z') as s`, [ids.loner]);
      return s;
    });
    expect(state).toMatchObject({ current: 1, paused: true, broken: false });
  });

  it("shows the record and offers the period's repair after a missed week; one repair per period", async () => {
    const now = new Date();
    const cur = weekStartCR(now);
    const day = (week: string) => `${week} 10:00`;
    const out = await scenario(async (q, act) => {
      const items = await makeItems(q, 5);
      // Met three and two weeks ago, missed last week.
      await rightAnswers(q, ids.loner, items, 5, day(addWeeks(cur, -3)));
      await rightAnswers(q, ids.loner, items, 5, day(addWeeks(cur, -2)));
      await rightAnswers(q, ids.loner, items, 1, day(addWeeks(cur, -1)));
      await act(user(ids.loner));
      const [{ before }] = await q(`select public.streak_status() as before`);
      const [{ used }] = await q(`select public.use_streak_repair() as used`);
      const [{ again }] = await q(`select public.use_streak_repair() as again`);
      const direct = await q(`select count(*)::int as n from public.streak_repairs where student_id = $1`, [ids.loner]);
      await act(null);
      const events = await q(`select name, props from public.events where actor_id = $1 and name = 'streak_repaired'`, [ids.loner]);
      return { before, used, again, direct, events };
    });
    expect(out.before).toMatchObject({ current: 0, record: 2, broken: true, can_repair: true, repair_week: addWeeks(cur, -1) });
    expect(out.used).toMatchObject({ ok: true, status: { current: 3, broken: false, can_repair: false } });
    expect(out.again).toEqual({ ok: false, error: "not_available" });
    expect(out.direct[0].n).toBe(1);
    expect(out.events).toEqual([{ name: "streak_repaired", props: { week: addWeeks(cur, -1) } }]);
  });

  it("uses the section's weekly target and hides the streak only when every section turns it off", async () => {
    const out = await scenario(async (q, act) => {
      const items = await makeItems(q, 2);
      await rightAnswers(q, ids.student1b, items, 2, `${weekStartCR(new Date())} 10:00`);
      await act(user(ids.teacher1));
      await q(`insert into public.section_settings (section_id, weekly_target) values ($1, 2)`, [ids.section1]);
      await act(user(ids.student1b));
      const [{ on }] = await q(`select public.streak_status() as on`);
      await act(user(ids.teacher1));
      await q(`update public.section_settings set streak_enabled = false where section_id = $1`, [ids.section1]);
      await act(user(ids.student1b));
      const [{ off }] = await q(`select public.streak_status() as off`);
      await act(user(ids.loner));
      const [{ alone }] = await q(`select public.streak_status() as alone`);
      return { on, off, alone };
    });
    expect(out.on).toMatchObject({ target: 2, week_count: 2, week_done: true, current: 1, visible: true });
    expect(out.off.visible).toBe(false);
    expect(out.alone).toMatchObject({ visible: true, target: 5 });
  });

  it("logs the week as completed once, with no personal data", async () => {
    const events = await scenario(async (q) => {
      const items = await makeItems(q, 6);
      await rightAnswers(q, ids.loner, items, 6, `${weekStartCR(new Date())} 10:00`);
      return q(`select props from public.events where actor_id = $1 and name = 'streak_week_completed'`, [ids.loner]);
    });
    expect(events).toEqual([{ props: { week: weekStartCR(new Date()), target: 5 } }]);
  });

  it("students cannot write repairs or read section settings directly", async () => {
    await expectDenied(db, loner, `insert into public.streak_repairs (student_id, week_start, period_key) values ($1, '2027-03-01', 'x')`, [ids.loner], /permission denied/);
    const rows = await as(db, s1, `select * from public.section_settings`);
    expect(rows).toEqual([]);
    await expectDenied(db, anon, `select public.streak_status()`, [], /permission denied/);
  });

  it("the teacher sees aggregates of own sections only, and only they change the settings", async () => {
    const [summary] = await as<{ s: { students: number; enabled: boolean; target: number } }>(db, t1, `select public.section_streak_summary($1) as s`, [ids.section1]);
    expect(summary.s).toMatchObject({ students: 2, enabled: true, target: 5 });
    await expectDenied(db, t2, `select public.section_streak_summary($1)`, [ids.section1], /not your section/);
    await expectDenied(db, t2, `insert into public.section_settings (section_id, streak_enabled) values ($1, false)`, [ids.section1], /row-level security/);
    await expectDenied(db, s1, `insert into public.section_settings (section_id, streak_enabled) values ($1, false)`, [ids.section1], /row-level security|permission denied/);
  });
});

describe("institutions and school calendars", () => {
  const trimesters = JSON.stringify([
    { starts_on: "2027-02-08", ends_on: "2027-05-07", label: "Primer trimestre" },
    { starts_on: "2027-05-10", ends_on: "2027-08-27", label: "Segundo trimestre" },
    { starts_on: "2027-08-30", ends_on: "2027-12-03", label: "Tercer trimestre" },
  ]);
  const breaks = JSON.stringify([{ starts_on: "2027-07-05", ends_on: "2027-07-16", label: "Vacaciones de medio año" }]);
  const save = `select public.save_institution_calendar($1, 2027::smallint, '2027-02-08', '2027-12-03', $2, $3) as cal`;

  it("only platform admins create institutions; members see theirs", async () => {
    await expectDenied(db, t1, `insert into public.institutions (name) values ('Liceo de prueba')`, [], /row-level security/);
    const out = await scenario(async (q, act) => {
      await act(admin);
      const [{ id }] = await q(`insert into public.institutions (name, slug) values ('Liceo de prueba', 'liceo-prueba') returning id`);
      await q(`insert into public.institution_members (institution_id, profile_id, role) values ($1, $2, 'admin')`, [id, ids.teacher1]);
      await act(user(ids.teacher1));
      const mine = await q(`select name from public.institutions`);
      await act(user(ids.teacher2));
      const theirs = await q(`select name from public.institutions`);
      return { mine, theirs };
    });
    expect(out.mine).toEqual([{ name: "Liceo de prueba" }]);
    expect(out.theirs).toEqual([]);
  });

  it("an institution admin sets its calendar with 3 trimesters; it pauses its sections' students", async () => {
    const out = await scenario(async (q, act) => {
      const [{ id }] = await q(`insert into public.institutions (name) values ('Liceo de prueba') returning id`);
      await q(`insert into public.institution_members (institution_id, profile_id, role) values ($1, $2, 'admin'), ($1, $3, 'teacher')`, [id, ids.teacher1, ids.teacher2]);
      await act(user(ids.teacher2));
      let teacherError = "";
      await q("savepoint s");
      try { await q(save, [id, breaks, trimesters]); } catch (e) { teacherError = (e as Error).message; await q("rollback to savepoint s"); }
      await act(user(ids.teacher1));
      const [{ cal }] = await q(save, [id, breaks, trimesters]);
      await q(`update public.sections set institution_id = $1 where id = $2`, [id, ids.section1]);
      await act(null);
      const periods = await q(`select label from public.school_calendar_periods where calendar_id = $1 order by sort_order`, [cal]);
      // 12 July 2027 is a class week for MEP but a break for this institution.
      const [{ inst }] = await q(`select private.week_paused($1, '2027-07-12') as inst`, [ids.student1]);
      const [{ mep }] = await q(`select private.week_paused($1, '2027-07-19') as mep`, [ids.student1]);
      const [{ per }] = await q(`select (private.week_period($1, '2027-06-07')).label as per`, [ids.student1]);
      return { teacherError, periods, inst, mep, per };
    });
    expect(out.teacherError).toMatch(/not an admin/);
    expect(out.periods.map((p) => p.label)).toEqual(["Primer trimestre", "Segundo trimestre", "Tercer trimestre"]);
    expect(out.inst).toBe(true);
    // Student1's only section follows the institution's calendar, not the official one.
    expect(out.mep).toBe(false);
    expect(out.per).toBe("Segundo trimestre");
  });

  it("rejects overlapping periods and dates outside the school year", async () => {
    const bad = JSON.stringify([
      { starts_on: "2027-02-08", ends_on: "2027-06-30", label: "Periodo A" },
      { starts_on: "2027-06-01", ends_on: "2027-12-03", label: "Periodo B" },
    ]);
    const err = await scenario(async (q, act) => {
      const [{ id }] = await q(`insert into public.institutions (name) values ('Liceo de prueba') returning id`);
      await q(`insert into public.institution_members (institution_id, profile_id, role) values ($1, $2, 'admin')`, [id, ids.teacher1]);
      await act(user(ids.teacher1));
      try { await q(save, [id, breaks, bad]); return ""; } catch (e) { return (e as Error).message; }
    });
    expect(err).toMatch(/must not overlap/);
  });

  it("a teacher can only attach a section to an institution they belong to", async () => {
    const err = await scenario(async (q, act) => {
      const [{ id }] = await q(`insert into public.institutions (name) values ('Otro liceo') returning id`);
      await act(user(ids.teacher1));
      try { await q(`update public.sections set institution_id = $1 where id = $2`, [id, ids.section1]); return ""; } catch (e) { return (e as Error).message; }
    });
    expect(err).toMatch(/not a member/);
  });

  it("calendars are public school dates; nobody writes them through the API", async () => {
    const rows = await as<{ name: string }>(db, anon, `select name from public.school_calendars where institution_id is null`);
    expect(rows).toEqual([{ name: "MEP 2027" }]);
    await expectDenied(db, t1, `insert into public.school_calendars (name, school_year, classes_start, classes_end) values ('x', 2028, '2028-03-01', '2028-11-30')`, [], /permission denied/);
    await expectDenied(db, t1, `delete from public.school_calendar_breaks`, [], /permission denied/);
  });
});

// ---------------------------------------------------------------------------
// Fase 2: weekly mastery changes, the section's goal and the nickname table
// ---------------------------------------------------------------------------
type Q = (sql: string, params?: unknown[]) => Promise<pg.QueryResultRow[]>;

/** Adds `n` synthetic anonymous students to section 1 (inside a scenario). Returns their ids. */
async function classmates(q: Q, n: number): Promise<string[]> {
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const id = `00000000-0000-4000-9000-${String(k + 1).padStart(12, "0")}`;
    await q(`insert into auth.users (id, email, is_anonymous) values ($1, null, true)`, [id]);
    await q(`insert into public.students (id, declared_grade_id) values ($1, 7)`, [id]);
    await q(`insert into public.section_members (section_id, student_id, display_name, consent_at) values ($1, $2, $3, now())`, [ids.section1, id, `Sintético ${k + 1}`]);
    out.push(id);
  }
  return out;
}

const thisWeek = () => weekStartCR(new Date());

describe("weekly mastery changes", () => {
  it("submit_attempt records where each skill started and ended the week", async () => {
    const out = await scenario(async (q, act) => {
      await act(user(ids.loner));
      await q(`select public.submit_attempt($1, 2::smallint)`, [ids.itemVerified]);
      await q(`select public.submit_attempt($1, 0::smallint)`, [ids.itemVerified]);
      const own = await q(`select score_start, score_end, attempts, week_start::text from public.mastery_weekly where student_id = $1`, [ids.loner]);
      const [m] = await q(`select score from public.mastery where student_id = $1`, [ids.loner]);
      await act(user(ids.student2));
      const other = await q(`select * from public.mastery_weekly where student_id = $1`, [ids.loner]);
      return { own, m, other };
    });
    expect(out.own).toHaveLength(1);
    expect(Number(out.own[0].score_start)).toBe(0.5);
    expect(Number(out.own[0].score_end)).toBe(Number(out.m.score));
    expect(out.own[0]).toMatchObject({ attempts: 2, week_start: thisWeek() });
    expect(out.other).toEqual([]);
    await expectDenied(db, loner, `insert into public.mastery_weekly (student_id, skill_id, week_start, score_start, score_end) values ($1, $2, '2027-03-01', 0.1, 0.9)`, [ids.loner, ids.skillPublished], /permission denied/);
  });
});

describe("section weekly goal", () => {
  it("is computed once a week like goalTarget(), with the progress of the section's students", async () => {
    const out = await scenario(async (q, act) => {
      const mates = await classmates(q, 4);
      // History: skills mastered in the last 4 weeks by the section (4, 6, 5, 7) → median 5.5 → 7.
      const hist = [4, 6, 5, 7];
      for (let k = 0; k < hist.length; k++) {
        const week = addWeeks(thisWeek(), -(k + 1));
        for (let j = 0; j < hist[k]; j++) {
          await q(`insert into public.skills (unit_id, subject_id, grade_id, name) values ($1, 'matematicas', 7, $2) returning id`, [ids.unitPublished, `h${k}-${j}`]).then(([r]) =>
            q(`insert into public.mastery_weekly (student_id, skill_id, week_start, score_start, score_end) values ($1, $2, $3, 0.5, 0.75)`, [mates[j % 4], r.id, week]));
        }
      }
      // This week: two skills crossed 0.7, one did not, one is of another grade (not in scope).
      await q(`insert into public.mastery_weekly (student_id, skill_id, week_start, score_start, score_end) values ($1, $2, $3, 0.6, 0.8), ($4, $2, $3, 0.65, 0.71), ($5, $2, $3, 0.5, 0.69)`, [mates[0], ids.skillPublished, thisWeek(), mates[1], mates[2]]);
      const [{ g8 }] = await q(`insert into public.skills (unit_id, subject_id, grade_id, name) values ($1, 'matematicas', 8, 'octavo') returning id as g8`, [ids.unitDraft]);
      await q(`insert into public.mastery_weekly (student_id, skill_id, week_start, score_start, score_end) values ($1, $2, $3, 0.5, 0.9)`, [mates[3], g8, thisWeek()]);
      await act(user(ids.student1));
      const [{ goal }] = await q(`select public.section_goal($1) as goal`, [ids.section1]);
      // More history does not change this week's goal: it is fixed on its first computation.
      await act(null);
      await q(`delete from public.mastery_weekly where week_start < $1`, [thisWeek()]);
      await act(user(ids.teacher1));
      const [{ again }] = await q(`select public.section_goal($1) as again`, [ids.section1]);
      return { goal, again };
    });
    // Progress 3: the two skills above plus the fixture's student1, whose mastery reached 0.8 this week.
    expect(out.goal).toMatchObject({ enabled: true, paused: false, target: goalTarget(1, [4, 6, 5, 7]), progress: 3, history: [4, 6, 5, 7] });
    expect(out.goal.target).toBe(7);
    expect(out.again.target).toBe(7);
  });

  it("without history: half a skill per active student, at least 3; turned off by the teacher", async () => {
    const out = await scenario(async (q, act) => {
      await act(user(ids.student1));
      const [{ goal }] = await q(`select public.section_goal($1) as goal`, [ids.section1]);
      await act(user(ids.teacher1));
      await q(`insert into public.section_settings (section_id, goal_enabled) values ($1, false)`, [ids.section1]);
      await act(user(ids.student1));
      const [{ off }] = await q(`select public.section_goal($1) as off`, [ids.section1]);
      return { goal, off };
    });
    expect(out.goal).toMatchObject({ enabled: true, target: 3, history: [0, 0, 0, 0] });
    expect(out.off).toEqual({ enabled: false });
  });

  it("only the section's students and teacher can see it", async () => {
    await expectDenied(db, s2, `select public.section_goal($1)`, [ids.section1], /not your section/);
    await expectDenied(db, t2, `select public.section_goal($1)`, [ids.section1], /not your section/);
    await expectDenied(db, anon, `select public.section_goal($1)`, [ids.section1], /permission denied/);
    await expectDenied(db, s1, `insert into public.section_goals (section_id, week_start, target, active_students) values ($1, '2027-03-01', 1, 1)`, [ids.section1], /permission denied/);
  });
});

describe("nicknames", () => {
  it("the SQL lists are the same as the TypeScript ones", async () => {
    const [r] = await as<{ nouns: string[]; adjectives: string[] }>(db, service, `select private.nickname_nouns() as nouns, private.nickname_adjectives() as adjectives`).catch(async () =>
      (await db.query(`select private.nickname_nouns() as nouns, private.nickname_adjectives() as adjectives`)).rows as { nouns: string[]; adjectives: string[] }[]);
    expect(r.nouns).toEqual([...NICKNAME_NOUNS]);
    expect(r.adjectives).toEqual([...NICKNAME_ADJECTIVES]);
  });

  it("are chosen from the safe list, are unique and cannot be written directly", async () => {
    const out = await scenario(async (q, act) => {
      await act(user(ids.loner));
      const options = (await q(`select public.nickname_options() as n`)).map((r) => r.n as string);
      const [{ ok }] = await q(`select public.choose_nickname('Tucán Azul 27') as ok`);
      const [{ bad }] = await q(`select public.choose_nickname('Juan Pérez 27') as bad`);
      await act(user(ids.student1));
      const [{ taken }] = await q(`select public.choose_nickname('Tucán Azul 27') as taken`);
      return { options, ok, bad, taken };
    });
    expect(out.options).toHaveLength(6);
    expect(out.options.every(isSafeNickname)).toBe(true);
    expect(out.ok).toEqual({ ok: true });
    expect(out.bad).toEqual({ ok: false, error: "not_in_list" });
    expect(out.taken).toEqual({ ok: false, error: "taken" });
    await expectDenied(db, s1, `update public.students set nickname = 'Juan Pérez' where id = $1`, [ids.student1], /permission denied/);
    await expectDenied(db, user(ids.newDevice), `insert into public.students (id, nickname) values ($1, 'Juan Pérez')`, [ids.newDevice], /permission denied/);
    await expectDenied(db, t1, `select public.choose_nickname('Tucán Azul 27')`, [], /staff accounts/);
  });
});

describe("the week's table with nicknames", () => {
  /** 8 classmates with nicknames and improvements 0.80, 0.70 … 0.10; returns their ids. */
  async function table(q: Q) {
    const mates = await classmates(q, 8);
    for (let k = 0; k < mates.length; k++) {
      await q(`update public.students set nickname = $2 where id = $1`, [mates[k], `Ceiba Feliz ${11 + k}`]);
      await q(`insert into public.mastery_weekly (student_id, skill_id, week_start, score_start, score_end) values ($1, $2, $3, 0.1, $4)`, [mates[k], ids.skillPublished, thisWeek(), 0.1 + (8 - k) / 10]);
    }
    return mates;
  }

  it("matches leaderboardWindow(): own row, up to 2 above and 2 below, no last place, no ids", async () => {
    const out = await scenario(async (q, act) => {
      const mates = await table(q);
      const views: Record<string, unknown> = {};
      for (const k of [0, 3, 6, 7]) {
        await act(user(mates[k]));
        views[k] = (await q(`select public.section_leaderboard($1) as t`, [ids.section1]))[0].t;
        await act(null);
      }
      return { mates, views };
    });
    const entries = out.mates.map((id, k) => ({ id, nickname: `Ceiba Feliz ${11 + k}`, hidden: false, improvement: (8 - k) / 10 }));
    for (const k of [0, 3, 6, 7]) {
      const view = out.views[k] as { rows: { nickname: string; points: number; me: boolean }[]; enough: boolean };
      expect(view.enough).toBe(true);
      expect(view.rows).toEqual(leaderboardWindow(entries, out.mates[k]));
      for (const row of view.rows) expect(Object.keys(row).sort()).toEqual(["me", "nickname", "points"]);
    }
    // The last place (Ceiba Feliz 18) is only visible to that student.
    expect(JSON.stringify(out.views[6])).not.toContain("Ceiba Feliz 18");
    expect(JSON.stringify(out.views[7])).toContain("Ceiba Feliz 18");
  });

  it("hidden students disappear; with fewer than 4 ranked nothing is shown", async () => {
    const out = await scenario(async (q, act) => {
      const mates = await table(q);
      await act(user(mates[1]));
      await q(`select public.set_leaderboard_hidden(true)`);
      await act(user(mates[0]));
      const [{ t }] = await q(`select public.section_leaderboard($1) as t`, [ids.section1]);
      await act(null);
      await q(`update public.students set leaderboard_hidden = true where id = any($1)`, [mates.slice(2, 7)]);
      await act(user(mates[0]));
      const [{ few }] = await q(`select public.section_leaderboard($1) as few`, [ids.section1]);
      await act(null);
      const ev = await q(`select props from public.events where actor_id = $1 and name = 'leaderboard_hidden'`, [mates[1]]);
      return { t, few, ev };
    });
    expect(JSON.stringify(out.t)).not.toContain("Ceiba Feliz 12");
    expect(out.few).toMatchObject({ enough: false, rows: [], me: { nickname: "Ceiba Feliz 11", points: 80 } });
    expect(out.ev).toEqual([{ props: { hidden: true } }]);
  });

  it("is for the section's students only; the teacher sees counts, and can turn it off", async () => {
    await expectDenied(db, s2, `select public.section_leaderboard($1)`, [ids.section1], /not your section/);
    await expectDenied(db, t1, `select public.section_leaderboard($1)`, [ids.section1], /not your section/);
    const out = await scenario(async (q, act) => {
      await table(q);
      await act(user(ids.teacher1));
      const [{ c }] = await q(`select public.section_leaderboard_summary($1) as c`, [ids.section1]);
      const [{ other }] = await q(`select public.section_leaderboard_summary($1) as other`, [ids.section2]);
      await q(`insert into public.section_settings (section_id, leaderboard_enabled) values ($1, false)`, [ids.section1]);
      await act(user(ids.student1));
      const [{ off }] = await q(`select public.section_leaderboard($1) as off`, [ids.section1]);
      return { c, other, off };
    });
    expect(out.c).toEqual({ members: 10, with_nickname: 8, hidden: 0 });
    expect(out.other).toBeNull();
    expect(out.off).toEqual({ enabled: false });
  });

  it("a recovery code carries the nickname and the week's changes to the new device", async () => {
    const out = await scenario(async (q, act) => {
      await q(`update public.students set nickname = 'Lapa Leal 42' where id = $1`, [ids.student2]);
      await q(`insert into public.mastery_weekly (student_id, skill_id, week_start, score_start, score_end) values ($1, $2, $3, 0.3, 0.6)
               on conflict (student_id, skill_id, week_start) do update set score_start = 0.3, score_end = 0.6`, [ids.student2, ids.skillPublished, thisWeek()]);
      await act(user(ids.student2));
      const [{ code }] = await q(`select public.create_recovery_code() as code`);
      await act(user(ids.newDevice));
      const [{ r }] = await q(`select public.redeem_recovery_code($1) as r`, [code]);
      await act(null);
      const [st] = await q(`select nickname from public.students where id = $1`, [ids.newDevice]);
      const weekly = await q(`select count(*)::int as n from public.mastery_weekly where student_id = $1`, [ids.newDevice]);
      return { r, st, weekly };
    });
    expect(out.r.ok).toBe(true);
    expect(out.st.nickname).toBe("Lapa Leal 42");
    expect(out.weekly[0].n).toBe(1);
  });
});

describe("section pause (fix of fase 1)", () => {
  it("a year without a calendar does not pause the section; the MEP 2027 break does", async () => {
    const rows = await db.query(
      `select private.week_paused_for_section($1, '2026-11-02') as no_calendar,
              private.week_paused_for_section($1, '2027-07-12') as mep_break,
              private.week_paused_for_section($1, '2027-03-08') as mep_class`,
      [ids.section1],
    );
    expect(rows.rows[0]).toEqual({ no_calendar: false, mep_break: true, mep_class: false });
    const [summary] = await as<{ s: { paused: boolean } }>(db, t1, `select public.section_streak_summary($1) as s`, [ids.section1]);
    expect(summary.s.paused).toBe(false);
  });
});
