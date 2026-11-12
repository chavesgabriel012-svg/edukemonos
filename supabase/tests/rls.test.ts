import type pg from "pg";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { type Fixture, ids, loadFixture } from "./fixtures";
import { addWeeks, classDays, computeStreak, estimateAbility, type GeneratedGame, goalTarget, memberPoints, splitGame, isSafeNickname, leaderboardWindow, levelOf, MEP_2027, NICKNAME_ADJECTIVES, NICKNAME_NOUNS, snakeTeams, teamScore, updateMastery, visibleTeams, weekStartCR } from "@edukemonos/curriculum";
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
      "attempts", "diagnostics", "game_runs", "group_members", "mastery", "mastery_weekly", "section_members", "streak_repairs", "student_recovery_codes",
      "tournament_members", "tutor_sessions", "writing_feedback",
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

// ---------------------------------------------------------------------------
// Groups and one section per subject: teacher = subject, guide = group
// ---------------------------------------------------------------------------
describe("groups and subject sections", () => {
  const teacher3 = "00000000-0000-4000-8000-0000000000c3";
  const outsider = "00000000-0000-4000-8000-0000000000c4";

  /**
   * Institution with teacher1 (admin) and teacher2 and teacher3 (teachers); group 7-3 with a Math
   * section (teacher1) and a Spanish section (teacher2); teacher3 is the guide. A published Spanish
   * unit with one item. Returns ids.
   */
  async function school(q: Q, act: (a: ReturnType<typeof user> | null) => Promise<void>) {
    await q(`insert into auth.users (id, email, is_anonymous) values ($1, 'teacher3@example.test', false), ($2, 'outsider@example.test', false)`, [teacher3, outsider]);
    const [{ inst }] = await q(`insert into public.institutions (name) values ('Liceo de prueba') returning id as inst`);
    await q(`insert into public.institution_members (institution_id, profile_id, role) values ($1, $2, 'admin'), ($1, $3, 'teacher'), ($1, $4, 'teacher')`, [inst, ids.teacher1, ids.teacher2, teacher3]);
    const [{ unit }] = await q(
      `insert into public.curriculum_units (cycle_id, grade_id, subject_id, title, source_id, source_page, source_excerpt, status)
       values ('III', 7, 'espanol', 'Unidad de español', $1, 12, 'extracto', 'published') returning id as unit`, [ids.source]);
    const [{ skill }] = await q(`insert into public.skills (unit_id, subject_id, grade_id, name) values ($1, 'espanol', 7, 'Habilidad de español') returning id as skill`, [unit]);
    const [{ item }] = await q(
      `insert into public.items (unit_id, skill_ids, stem, options, correct_index, explanation, distractor_explanations, difficulty, verified, status)
       values ($1, array[$2::uuid], 'tilde', array['a','b','c','d'], 1, 'e', array['x','x','x','x'], 3, true, 'published') returning id as item`, [unit, skill]);

    await act(user(ids.teacher1));
    const [{ g }] = await q(`select public.create_group('7-3', 7::smallint, $1) as g`, [inst]);
    const [{ math }] = await q(`insert into public.sections (teacher_id, name, grade_id, group_id, subject_id, join_code) values ($1, '7-3 Matemáticas', 7, $2, 'matematicas', '') returning id as math`, [ids.teacher1, g]);
    await q(`select public.set_group_guide($1, 'teacher3@example.test')`, [g]);
    await act(user(ids.teacher2));
    const [{ esp }] = await q(`insert into public.sections (teacher_id, name, grade_id, group_id, subject_id, join_code) values ($1, '7-3 Español', 9, $2, 'espanol', '') returning id as esp`, [ids.teacher2, g]);
    await act(null);
    const [{ code }] = await q(`select join_code as code from public.groups where id = $1`, [g]);
    return { inst, g, math, esp, code, espItem: item, espSkill: skill };
  }

  it("one group code puts the student in every subject; each teacher sees only their subject; the guide sees all", async () => {
    const out = await scenario(async (q, act) => {
      const s = await school(q, act);
      await act(user(ids.loner));
      const [{ joined }] = await q(`select public.join_with_code($1, 'Estudiante Sintético Nueve', true) as joined`, [s.code.toLowerCase()]);
      await q(`select public.submit_attempt($1, 2::smallint)`, [ids.itemVerified]);   // Math, right
      await q(`select public.submit_attempt($1, 1::smallint)`, [s.espItem]);         // Spanish, right
      const own = await q(`select subject_id from public.attempts where student_id = $1 order by subject_id`, [ids.loner]);
      const read = async (who: string) => {
        await act(user(who));
        const attempts = (await q(`select subject_id from public.attempts where student_id = $1 order by subject_id`, [ids.loner])).map((r) => r.subject_id);
        const mastery = (await q(`select subject_id from public.mastery where student_id = $1 order by subject_id`, [ids.loner])).map((r) => r.subject_id);
        const weekly = (await q(`select subject_id from public.mastery_weekly where student_id = $1 order by subject_id`, [ids.loner])).map((r) => r.subject_id);
        const names = (await q(`select display_name from public.group_members where student_id = $1`, [ids.loner])).map((r) => r.display_name);
        return { attempts, mastery, weekly, names };
      };
      const math = await read(ids.teacher1);
      const esp = await read(ids.teacher2);
      const guide = await read(teacher3);
      const stranger = await read(outsider);
      await act(null);
      const members = await q(`select section_id from public.section_members where student_id = $1 order by section_id`, [ids.loner]);
      const [{ grade }] = await q(`select grade_id as grade from public.sections where id = $1`, [s.esp]);
      return { s, joined, own, math, esp, guide, stranger, members, grade };
    });
    expect(out.joined).toMatchObject({ kind: "group", name: "7-3", grade_id: 7, subjects: ["Español", "Matemáticas"] });
    expect(out.members.map((m) => m.section_id).sort()).toEqual([out.s.math, out.s.esp].sort());
    expect(out.own.map((r) => r.subject_id)).toEqual(["espanol", "matematicas"]);
    expect(out.math).toEqual({ attempts: ["matematicas"], mastery: ["matematicas"], weekly: ["matematicas"], names: ["Estudiante Sintético Nueve"] });
    expect(out.esp).toEqual({ attempts: ["espanol"], mastery: ["espanol"], weekly: ["espanol"], names: ["Estudiante Sintético Nueve"] });
    expect(out.guide).toEqual({ attempts: ["espanol", "matematicas"], mastery: ["espanol", "matematicas"], weekly: ["espanol", "matematicas"], names: ["Estudiante Sintético Nueve"] });
    expect(out.stranger).toEqual({ attempts: [], mastery: [], weekly: [], names: [] });
    // The section's grade comes from the group, whatever was sent.
    expect(out.grade).toBe(7);
  });

  it("a subject teacher only sees diagnostics, tutor topics and writing of their subject", async () => {
    const out = await scenario(async (q, act) => {
      const s = await school(q, act);
      await act(user(ids.loner));
      await q(`select public.join_with_code($1, 'Nueve', true)`, [s.code]);
      await act(null);
      await q(`insert into public.diagnostics (student_id, subject_id, grade_id) values ($1, 'espanol', 7), ($1, 'matematicas', 7)`, [ids.loner]);
      const [{ espUnit }] = await q(`select unit_id as "espUnit" from public.skills where id = $1`, [s.espSkill]);
      await q(`insert into public.tutor_sessions (student_id, unit_id, topic) values ($1, $2, 'tildes'), ($1, $3, 'potencias'), ($1, null, 'general')`, [ids.loner, espUnit, ids.unitPublished]);
      await q(`insert into public.writing_feedback (student_id, unit_id, category, count) values ($1, $2, 'tildes', 2)`, [ids.loner, espUnit]);
      await act(user(ids.teacher1));
      const diag = (await q(`select subject_id from public.diagnostics where student_id = $1`, [ids.loner])).map((r) => r.subject_id);
      const topics = (await q(`select topic from public.tutor_sessions where student_id = $1 order by topic`, [ids.loner])).map((r) => r.topic);
      const writing = await q(`select * from public.writing_feedback where student_id = $1`, [ids.loner]);
      await act(user(teacher3));
      const guideTopics = (await q(`select topic from public.tutor_sessions where student_id = $1 order by topic`, [ids.loner])).map((r) => r.topic);
      return { diag, topics, writing, guideTopics };
    });
    expect(out.diag).toEqual(["matematicas"]);
    expect(out.topics).toEqual(["potencias"]);         // no Spanish topic, no topic outside a unit
    expect(out.writing).toEqual([]);
    expect(out.guideTopics).toEqual(["general", "potencias", "tildes"]);
  });

  it("the goal and the table of a subject section count only that subject", async () => {
    const out = await scenario(async (q, act) => {
      const s = await school(q, act);
      await act(user(ids.loner));
      await q(`select public.join_with_code($1, 'Nueve', true)`, [s.code]);
      await act(null);
      await q(`insert into public.mastery_weekly (student_id, skill_id, week_start, score_start, score_end) values ($1, $2, $3, 0.5, 0.8)`, [ids.loner, s.espSkill, thisWeek()]);
      const [{ math }] = await q(`select private.section_week_mastered($1, $2) as math`, [s.math, thisWeek()]);
      const [{ esp }] = await q(`select private.section_week_mastered($1, $2) as esp`, [s.esp, thisWeek()]);
      return { math, esp };
    });
    expect(out).toEqual({ math: 0, esp: 1 });
  });

  it("a code of a section in a group joins the whole group; a section added later includes the group's students", async () => {
    const out = await scenario(async (q, act) => {
      const s = await school(q, act);
      const [{ sectionCode }] = await q(`select join_code as "sectionCode" from public.sections where id = $1`, [s.esp]);
      await act(user(ids.loner));
      const [{ joined }] = await q(`select public.join_with_code($1, 'Nueve', true) as joined`, [sectionCode]);
      await act(user(teacher3));
      const [{ sci }] = await q(`insert into public.sections (teacher_id, name, grade_id, group_id, subject_id, join_code) values ($1, '7-3 Ciencias', 7, $2, 'ciencias', '') returning id as sci`, [teacher3, s.g]);
      await act(null);
      const members = await q(`select count(*)::int as n from public.section_members where student_id = $1`, [ids.loner]);
      const [{ inSci }] = await q(`select exists (select 1 from public.section_members where section_id = $1 and student_id = $2) as "inSci"`, [sci, ids.loner]);
      return { joined, members, inSci };
    });
    expect(out.joined.kind).toBe("group");
    expect(out.members[0].n).toBe(3);
    expect(out.inSci).toBe(true);
  });

  it("only the institution's teachers add subject sections, one per subject; only admins create institution groups", async () => {
    const errs = await scenario(async (q, act) => {
      const s = await school(q, act);
      const tryq = async (sql: string, params: unknown[]) => {
        await q("savepoint t");
        try { await q(sql, params); await q("release savepoint t"); return "ok"; } catch (e) { await q("rollback to savepoint t"); return (e as Error).message; }
      };
      await act(user(outsider));
      const foreign = await tryq(`insert into public.sections (teacher_id, name, grade_id, group_id, subject_id, join_code) values ($1, 'x', 7, $2, 'ingles', '')`, [outsider, s.g]);
      await act(user(ids.teacher2));
      const twice = await tryq(`insert into public.sections (teacher_id, name, grade_id, group_id, subject_id, join_code) values ($1, 'x', 7, $2, 'matematicas', '')`, [ids.teacher2, s.g]);
      const notAdmin = await tryq(`select public.create_group('7-4', 7::smallint, $1)`, [s.inst]);
      const standalone = await tryq(`select public.create_group('Mi grupo', 8::smallint, null)`, []);
      const noSubject = await tryq(`insert into public.sections (teacher_id, name, grade_id, group_id, join_code) values ($1, 'x', 7, $2, '')`, [ids.teacher2, s.g]);
      const guideOutside = await tryq(`select public.set_group_guide($1, 'outsider@example.test')`, [s.g]);
      await act(user(ids.teacher1));
      const guideOutsideByAdmin = await tryq(`select public.set_group_guide($1, 'outsider@example.test')`, [s.g]);
      return { foreign, twice, notAdmin, standalone, noSubject, guideOutside, guideOutsideByAdmin };
    });
    expect(errs.foreign).toMatch(/cannot add sections/);
    expect(errs.twice).toMatch(/duplicate key/);
    expect(errs.notAdmin).toMatch(/not an admin/);
    expect(errs.standalone).toBe("ok");
    expect(errs.noSubject).toMatch(/sections_group_needs_subject/);
    expect(errs.guideOutside).toMatch(/not your group/);
    expect(errs.guideOutsideByAdmin).toMatch(/must belong to the institution/);
  });

  it("the guide can take a student out of the group and of all its subjects; students only see their own group", async () => {
    const out = await scenario(async (q, act) => {
      const s = await school(q, act);
      await act(user(ids.loner));
      await q(`select public.join_with_code($1, 'Nueve', true)`, [s.code]);
      const mine = await q(`select name from public.groups`);
      await act(user(ids.student2));
      const notMine = await q(`select name from public.groups`);
      await q("savepoint o");
      const overview = await q(`select public.group_overview($1)`, [s.g]).then(() => "ok", async (e) => { await q("rollback to savepoint o"); return (e as Error).message; });
      await act(user(teacher3));
      const [{ ov }] = await q(`select public.group_overview($1) as ov`, [s.g]);
      await q(`select public.remove_group_member($1, $2)`, [s.g, ids.loner]);
      await act(null);
      const left = await q(`select count(*)::int as n from public.section_members where student_id = $1`, [ids.loner]);
      return { mine, notMine, overview, ov, left };
    });
    expect(out.mine).toEqual([{ name: "7-3" }]);
    expect(out.notMine).toEqual([]);
    expect(out.overview).toMatch(/not your group/);
    expect(out.ov).toMatchObject({ name: "7-3", is_guide: true, manages: false, students: 1 });
    expect(out.ov.sections.map((x: { subject: string }) => x.subject)).toEqual(["Español", "Matemáticas"]);
    expect(out.left[0].n).toBe(0);
  });

  it("group codes and section codes never collide, and a recovery code carries the group", async () => {
    const out = await scenario(async (q, act) => {
      const s = await school(q, act);
      const [{ clash }] = await q(`select exists (select 1 from public.sections where join_code = $1) as clash`, [s.code]);
      await act(user(ids.student2));
      await q(`select public.join_with_code($1, 'Dos', true)`, [s.code]);
      const [{ code }] = await q(`select public.create_recovery_code() as code`);
      await act(user(ids.newDevice));
      const [{ r }] = await q(`select public.redeem_recovery_code($1) as r`, [code]);
      await act(null);
      const groups = await q(`select group_id from public.group_members where student_id = $1`, [ids.newDevice]);
      return { clash, r, groups, g: s.g };
    });
    expect(out.clash).toBe(false);
    expect(out.r.moved.groups).toBe(1);
    expect(out.groups).toEqual([{ group_id: out.g }]);
  });
});

describe("a subject teacher across several groups", () => {
  it("teaches Math only in 7-1 and 8-3: sees exactly those two groups, not 7-2", async () => {
    const out = await scenario(async (q, act) => {
      const [{ inst }] = await q(`insert into public.institutions (name) values ('Liceo de prueba') returning id as inst`);
      await q(`insert into public.institution_members (institution_id, profile_id, role) values ($1, $2, 'admin'), ($1, $3, 'teacher')`, [inst, ids.teacher1, ids.teacher2]);
      await act(user(ids.teacher1));
      const groups: Record<string, string> = {};
      for (const [name, grade] of [["7-1", 7], ["7-2", 7], ["8-3", 8]] as const) {
        const [{ g }] = await q(`select public.create_group($1, $2::smallint, $3) as g`, [name, grade, inst]);
        groups[name] = g;
      }
      // teacher1 teaches Math in 7-1 and 8-3; teacher2 teaches Math in 7-2.
      for (const name of ["7-1", "8-3"]) {
        await q(`insert into public.sections (teacher_id, name, grade_id, group_id, subject_id, join_code) values ($1, $2, 7, $3, 'matematicas', '')`, [ids.teacher1, `${name} Matemáticas`, groups[name]]);
      }
      await act(user(ids.teacher2));
      await q(`insert into public.sections (teacher_id, name, grade_id, group_id, subject_id, join_code) values ($1, '7-2 Matemáticas', 7, $2, 'matematicas', '')`, [ids.teacher2, groups["7-2"]]);
      await act(null);
      // One student per group, each with a Math attempt.
      const students: Record<string, string> = {};
      let k = 0;
      for (const name of ["7-1", "7-2", "8-3"]) {
        const id = `00000000-0000-4000-9100-${String(++k).padStart(12, "0")}`;
        await q(`insert into auth.users (id, email, is_anonymous) values ($1, null, true)`, [id]);
        const [{ code }] = await q(`select join_code as code from public.groups where id = $1`, [groups[name]]);
        await act(user(id));
        await q(`select public.join_with_code($1, $2, true)`, [code, `Estudiante ${name}`]);
        await q(`select public.submit_attempt($1, 2::smallint)`, [ids.itemVerified]);
        await act(null);
        students[name] = id;
      }
      await act(user(ids.teacher1));
      const sections = (await q(`select name, grade_id from public.sections where teacher_id = $1 and group_id is not null order by name`, [ids.teacher1])).map((r) => `${r.name} (${r.grade_id}.º)`);
      const seen = (await q(`select distinct student_id from public.attempts where student_id = any($1)`, [Object.values(students)])).map((r) => r.student_id).sort();
      const names = (await q(`select display_name from public.section_members m join public.sections s on s.id = m.section_id where s.teacher_id = $1 and s.group_id is not null order by 1`, [ids.teacher1])).map((r) => r.display_name);
      return { sections, seen, names, students };
    });
    expect(out.sections).toEqual(["7-1 Matemáticas (7.º)", "8-3 Matemáticas (8.º)"]);
    expect(out.seen).toEqual([out.students["7-1"], out.students["8-3"]].sort());
    expect(out.names).toEqual(["Estudiante 7-1", "Estudiante 8-3"]);
  });
});

// ---------------------------------------------------------------------------
// Fase 3: mini-games
// ---------------------------------------------------------------------------
describe("mini-games", () => {
  const order: GeneratedGame = {
    mechanic: "order", skill_index: 0, instruction: "Ordena los pasos.", pairs: null,
    steps: ["Paréntesis", "Potencias", "Multiplicaciones y divisiones", "Sumas y restas"],
    stem: null, options: null, answer_index: null, correction: null, calc: null, explanation: "Jerarquía de operaciones.",
  };
  const pairs: GeneratedGame = {
    ...order, mechanic: "pairs", instruction: "Une cada término.", steps: null,
    pairs: [{ left: "Primo", right: "Dos divisores" }, { left: "Compuesto", right: "Más de dos divisores" }, { left: "Múltiplo", right: "Producto por un entero" }, { left: "Divisor", right: "Divide exacto" }],
  };
  const fill: GeneratedGame = { ...order, mechanic: "fill", instruction: "Completa.", steps: null, stem: "El MCD de 24 y 36 es ___.", options: ["6", "12", "18", "72"], answer_index: 1 };

  /** Inserts published, verified pieces in the published unit; returns ids and answers. */
  async function pieces(q: Q, games: GeneratedGame[]) {
    const out: { id: string; answer: ReturnType<typeof splitGame>["answer"] }[] = [];
    for (const [k, g] of games.entries()) {
      const { pub, answer } = splitGame(g, `test:${k}`);
      const [{ id }] = await q(
        `insert into public.items (unit_id, skill_ids, kind, stem, explanation, difficulty, verified, status, game_public, game_answer)
         values ($1, array[$2::uuid], $3::public.item_kind, $4, $5, 3, true, 'published', $6, $7) returning id`,
        [ids.unitPublished, ids.skillPublished, `game_${g.mechanic}`, g.instruction, g.explanation, JSON.stringify(pub), JSON.stringify(answer)],
      );
      out.push({ id, answer });
    }
    return out;
  }

  it("the answer of a piece is never readable through the API; its public part is", async () => {
    const out = await scenario(async (q, act) => {
      await pieces(q, [order]);
      await act(anon);
      const pub = await q(`select game_public from public.items where kind = 'game_order'`);
      await q("savepoint a");
      const denied = await q(`select game_answer from public.items`).then(() => "ok", async (e) => { await q("rollback to savepoint a"); return (e as Error).message; });
      return { pub, denied };
    });
    expect(out.pub).toHaveLength(1);
    expect(out.pub[0].game_public.steps).toHaveLength(4);
    expect(out.denied).toMatch(/permission denied/);
  });

  it("a play: the run gives no answers; answers are graded in the database and count for mastery as 'game'", async () => {
    const out = await scenario(async (q, act) => {
      const [p] = await pieces(q, [order]);
      await act(user(ids.loner));
      const [{ run }] = await q(`select public.start_game_run($1, 'order') as run`, [ids.unitPublished]);
      const ord = (p.answer as { order: number[] }).order;
      const [{ r }] = await q(`select public.submit_attempt($1, null, $2, null, 0::smallint, $3, 'game') as r`, [p.id, JSON.stringify(ord), run.run]);
      await q("savepoint b");
      const twice = await q(`select public.submit_attempt($1, null, $2, null, 0::smallint, $3, 'game')`, [p.id, JSON.stringify(ord), run.run]).then(() => "ok", async (e) => { await q("rollback to savepoint b"); return (e as Error).message; });
      const noRun = await q(`select public.submit_attempt($1, null, $2, null, 0::smallint, null, 'game')`, [p.id, JSON.stringify(ord)]).then(() => "ok", async (e) => { await q("rollback to savepoint b"); return (e as Error).message; });
      const [{ fin }] = await q(`select public.finish_game_run($1) as fin`, [run.run]);
      const attempts = await q(`select context, is_correct from public.attempts where student_id = $1`, [ids.loner]);
      const mastery = await q(`select attempts from public.mastery where student_id = $1`, [ids.loner]);
      await act(null);
      const ev = await q(`select props from public.events where actor_id = $1 and name = 'game_played'`, [ids.loner]);
      return { run, r, twice, noRun, fin, attempts, mastery, ev };
    });
    expect(out.run).toMatchObject({ ok: true, mode: "order", rival: null });
    expect(Object.keys(out.run.pieces[0]).sort()).toEqual(["game_public", "id", "kind", "options", "reviewed", "stem"]);
    expect(JSON.stringify(out.run)).not.toContain('"order":[');
    expect(out.r).toMatchObject({ is_correct: true, game_answer: { mechanic: "order" } });
    expect(out.twice).toMatch(/already answered/);
    expect(out.noRun).toMatch(/invalid game run/);
    expect(out.fin).toMatchObject({ correct: 1, total: 1, pattern: [true], new_record: true });
    expect(out.attempts).toEqual([{ context: "game", is_correct: true }]);
    expect(out.mastery[0].attempts).toBe(1);
    expect(out.ev).toEqual([{ props: { mechanic: "order", unit: ids.unitPublished, correct: 1, total: 1 } }]);
  });

  it("grades pairs strictly, rejects malformed answers and keeps game pieces out of the diagnostic", async () => {
    const out = await scenario(async (q, act) => {
      const [p, f] = await pieces(q, [pairs, fill]);
      await act(user(ids.loner));
      const [{ run }] = await q(`select public.start_game_run($1, 'pairs') as run`, [ids.unitPublished]);
      const wrong = [...(p.answer as { match: number[] }).match].reverse();
      const [{ r }] = await q(`select public.submit_attempt($1, null, $2, null, 0::smallint, $3, 'game') as r`, [p.id, JSON.stringify(wrong), run.run]);
      const [{ diag }] = await q(`select public.start_diagnostic('matematicas', 7::smallint) as diag`);
      await q("savepoint c");
      const inDiag = await q(`select public.submit_attempt($1, 1::smallint, null, null, 0::smallint, null, 'diagnostic', $2)`, [f.id, diag]).then(() => "ok", async (e) => { await q("rollback to savepoint c"); return (e as Error).message; });
      const [{ race }] = await q(`select public.start_game_run($1, 'ghost_race') as race`, [ids.unitPublished]);
      const [{ bad }] = await q(`select public.submit_attempt($1, null, 'not json', null, 0::smallint, $2, 'game') as bad`, [p.id, race.run]).catch(() => [{ bad: "not in race" }]);
      return { r, inDiag, race, bad };
    });
    expect(out.r.is_correct).toBe(false);
    expect(out.inDiag).toMatch(/cannot be used in diagnostics/);
    // The race uses verified exercises and fill pieces, never pairs.
    expect(out.race.pieces.map((x: { kind: string }) => x.kind).sort()).toEqual(["game_fill", "single_choice"]);
  });

  it("ghost race: the first time a classmate of the section (anonymous), then the student's own record", async () => {
    const out = await scenario(async (q, act) => {
      const [f] = await pieces(q, [fill]);
      const race = async (who: string, rightFill: boolean) => {
        await act(user(who));
        const [{ run }] = await q(`select public.start_game_run($1, 'ghost_race') as run`, [ids.unitPublished]);
        for (const piece of run.pieces) {
          const answer = piece.id === f.id ? (rightFill ? 1 : 0) : 2;   // itemVerified's key is 2
          await q(`select public.submit_attempt($1, $2::smallint, null, null, 0::smallint, $3, 'game')`, [piece.id, answer, run.run]);
        }
        const [{ fin }] = await q(`select public.finish_game_run($1) as fin`, [run.run]);
        await act(null);
        return { run, fin };
      };
      const first = await race(ids.student1, true);
      const second = await race(ids.student1b, false);   // student1b shares section 1 with student1
      const again = await race(ids.student1b, true);
      return { first, second, again };
    });
    expect(out.first.run.rival).toBeNull();
    expect(out.second.run.rival).toMatchObject({ kind: "peer" });
    expect(JSON.stringify(out.second.run.rival)).not.toContain(ids.student1);
    expect(out.second.fin).toMatchObject({ correct: 1, total: 2 });
    expect(out.again.run.rival).toMatchObject({ kind: "self", pattern: out.second.fin.pattern });
    expect(out.again.fin).toMatchObject({ correct: 2, new_record: true, best_before: 1 });
  });

  it("the teacher can turn games off; a student outside sections always has them", async () => {
    const out = await scenario(async (q, act) => {
      await pieces(q, [order]);
      await act(user(ids.teacher1));
      await q(`insert into public.section_settings (section_id, games_enabled) values ($1, false)`, [ids.section1]);
      await act(user(ids.student1));
      const [{ off }] = await q(`select public.start_game_run($1, 'order') as off`, [ids.unitPublished]);
      const [{ visible }] = await q(`select public.games_enabled_for_me() as visible`);
      await act(user(ids.loner));
      const [{ on }] = await q(`select public.start_game_run($1, 'order') as on`, [ids.unitPublished]);
      return { off, visible, on };
    });
    expect(out.off).toEqual({ ok: false, error: "disabled" });
    expect(out.visible).toBe(false);
    expect(out.on.ok).toBe(true);
  });

  it("the teacher sees game answers labelled 'game'; runs are private to the student", async () => {
    const out = await scenario(async (q, act) => {
      const [p] = await pieces(q, [order]);
      await act(user(ids.student1));
      const [{ run }] = await q(`select public.start_game_run($1, 'order') as run`, [ids.unitPublished]);
      await q(`select public.submit_attempt($1, null, '[0,1,2,3]', null, 0::smallint, $2, 'game')`, [p.id, run.run]);
      await act(user(ids.teacher1));
      const contexts = (await q(`select context from public.attempts where student_id = $1 order by context`, [ids.student1])).map((r) => r.context);
      const runs = await q(`select * from public.game_runs`);
      await act(user(ids.student2));
      const others = await q(`select * from public.game_runs`);
      return { contexts, runs, others };
    });
    expect(out.contexts).toContain("game");
    expect(out.runs).toEqual([]);
    expect(out.others).toEqual([]);
    await expectDenied(db, s1, `insert into public.game_runs (student_id, unit_id, mode, item_ids) values ($1, $2, 'order', '{}')`, [ids.student1, ids.unitPublished], /permission denied/);
  });
});

// ---------------------------------------------------------------------------
// Fase 4: the Friday tournament
// ---------------------------------------------------------------------------
describe("the Friday tournament", () => {
  /** Friday of this week at 10:00 Costa Rica time (16:00 UTC), as an ISO instant. */
  const friday = () => new Date(Date.parse(`${thisWeek()}T16:00:00Z`) + 4 * 86_400_000).toISOString();
  const thursday = () => new Date(Date.parse(`${thisWeek()}T16:00:00Z`) + 3 * 86_400_000).toISOString();

  /**
   * Seven active classmates in section 1 with distinct levels in the published skill, worked this
   * week, plus student1 from the fixture (active, mastery 0.8). student1b is a member but not active.
   * Adds 12 verified questions on the skill. Returns the classmates' ids.
   */
  async function week(q: Q) {
    const mates = await classmates(q, 7);
    const levels = [0.9, 0.35, 0.6, 0.75, 0.2, 0.55, 0.45];
    for (const [k, id] of mates.entries()) {
      await q(`insert into public.attempts (student_id, item_id, is_correct) values ($1, $2, true)`, [id, ids.itemVerified]);
      await q(`insert into public.mastery (student_id, skill_id, score) values ($1, $2, $3)`, [id, ids.skillPublished, levels[k]]);
    }
    const items = await makeItems(q, 12);
    await q(`update public.items set skill_ids = array[$1::uuid] where id = any($2)`, [ids.skillPublished, items]);
    return mates;
  }

  /** Opens the tournament now (it was built for Friday), so the public functions can be used. */
  async function openNow(q: Q, t: string) {
    await q(`update public.tournaments set opens_at = now() - interval '1 hour', closes_at = now() + interval '1 hour' where id = $1`, [t]);
  }

  it("is built once, from Friday, with balanced teams like snakeTeams(); not before Friday nor with fewer than 6 active", async () => {
    const out = await scenario(async (q) => {
      const mates = await week(q);
      const [{ early }] = await q(`select private.ensure_tournament($1, $2) as early`, [ids.section1, thursday()]);
      const [{ t }] = await q(`select private.ensure_tournament($1, $2) as t`, [ids.section1, friday()]);
      const [{ again }] = await q(`select private.ensure_tournament($1, $2) as again`, [ids.section1, friday()]);
      const levels = await q(`select student_id::text as id, score::float as level from public.mastery where skill_id = $1 and student_id = any($2)`, [ids.skillPublished, [...mates, ids.student1]]);
      const teams = await q(`select tt.name, array_agg(m.student_id::text order by m.student_id::text) as members
                             from public.tournament_teams tt join public.tournament_members m on m.team_id = tt.id
                             where tt.tournament_id = $1 group by tt.id, tt.sort_order order by tt.sort_order`, [t]);
      const [tour] = await q(`select skill_ids, week_start::text from public.tournaments where id = $1`, [t]);
      // A section with too few active students gets none.
      const [{ few }] = await q(`select private.ensure_tournament($1, $2) as few`, [ids.section2, friday()]);
      return { early, t, again, levels, teams, tour, few };
    });
    expect(out.early).toBeNull();
    expect(out.again).toBe(out.t);
    expect(out.tour).toEqual({ skill_ids: [ids.skillPublished], week_start: thisWeek() });
    const expected = snakeTeams(out.levels.map((r) => ({ id: r.id as string, level: r.level as number })));
    expect(out.teams.map((t) => [...t.members].sort())).toEqual(expected.map((t) => [...t].sort()));
    expect(out.teams.map((t) => t.members.length)).toEqual([4, 4]);
    for (const t of out.teams) expect(NICKNAME_NOUNS.map((n) => `Equipo ${n}`)).toContain(t.name);
    expect(out.few).toBeNull();
  });

  it("scores like memberPoints() and teamScore(); a student sees their team and the teams above the last, never names", async () => {
    const out = await scenario(async (q, act) => {
      const mates = await week(q);
      const [{ t }] = await q(`select private.ensure_tournament($1, $2) as t`, [ids.section1, friday()]);
      await openNow(q, t);
      const items = (await q(`select id from public.items where stem like 'racha %' order by stem`)).map((r) => r.id as string);
      // Tournament answers: mates[0] gets 12 right (only 10 count), mates[1] 2 right and 1 wrong.
      for (const [who, right, wrong] of [[mates[0], 12, 0], [mates[1], 2, 1]] as [string, number, number][]) {
        for (let k = 0; k < right + wrong; k++) {
          await q(`insert into public.attempts (student_id, item_id, context, session_id, is_correct) values ($1, $2, 'tournament', $3, $4)`, [who, items[k], t, k < right]);
        }
      }
      // Mastery gained this week in the topic (mastery_weekly was written by the mastery trigger).
      await q(`update public.mastery_weekly set score_start = 0.4, score_end = 0.55 where student_id = $1 and skill_id = $2`, [mates[2], ids.skillPublished]);
      const raw = await q(`select m.student_id::text as id, tt.id::text as team, tt.name,
                                  (select count(distinct a.item_id) filter (where a.is_correct) from public.attempts a where a.session_id = $1 and a.student_id = m.student_id and a.context = 'tournament')::int as correct,
                                  coalesce((select sum(w.score_end - w.score_start) from public.mastery_weekly w where w.student_id = m.student_id and w.skill_id = $2 and w.week_start = $3), 0)::float as improvement
                           from public.tournament_members m join public.tournament_teams tt on tt.id = m.team_id where m.tournament_id = $1`, [t, ids.skillPublished, thisWeek()]);
      const views: Record<string, unknown> = {};
      for (const who of [mates[0], mates[4]]) {
        await act(user(who));
        views[who] = (await q(`select public.section_tournament($1) as v`, [ids.section1]))[0].v;
        await act(null);
      }
      await act(user(ids.teacher1));
      const [{ report }] = await q(`select public.section_tournament_report($1) as report`, [ids.section1]);
      return { mates, raw, views, report };
    });
    // The same scores, computed in TypeScript from the raw answers and mastery changes.
    const byTeam = new Map<string, { id: string; name: string; points: number[] }>();
    for (const r of out.raw) {
      const e = byTeam.get(r.team) ?? { id: r.team as string, name: r.name as string, points: [] as number[] };
      e.points.push(memberPoints(r.correct, r.improvement));
      byTeam.set(r.team, e);
    }
    const teams = [...byTeam.values()].map((e) => ({ id: e.id, name: e.name, score: teamScore(e.points) }));
    const reportScores = Object.fromEntries(out.report.tournament.teams.map((t: { name: string; score: string }) => [t.name, Number(t.score)]));
    expect(reportScores).toEqual(Object.fromEntries(teams.map((t) => [t.name, t.score])));

    for (const who of [out.mates[0], out.mates[4]]) {
      const v = out.views[who] as { status: string; tournament: { teams: { name: string; score: string; me: boolean }[]; me: { team: string; points: number } } };
      expect(v.status).toBe("open");
      const mine = out.raw.find((r) => r.id === who)!;
      const expected = visibleTeams(teams, mine.team).map(({ name, score, me }) => ({ name, score, me }));
      expect(v.tournament.teams.map((t) => ({ ...t, score: Number(t.score) }))).toEqual(expected);
      expect(v.tournament.me.points).toBe(memberPoints(mine.correct, mine.improvement));
      const text = JSON.stringify(v);
      for (const id of out.mates) expect(text).not.toContain(id);
      expect(text).not.toContain("Sintético");
    }
    // mates[0]: 12 right answers, only 10 count.
    expect((out.views[out.mates[0]] as { tournament: { me: { counted: number; correct: number } } }).tournament.me).toMatchObject({ correct: 12, counted: 10 });
    // The teacher sees every team, the names and what each student added to their mastery.
    const members = out.report.tournament.teams.flatMap((t: { members: { name: string; improvement: number; played: boolean }[] }) => t.members);
    expect(members).toHaveLength(8);
    expect(members.find((m: { name: string }) => m.name === "Sintético 3")).toMatchObject({ improvement: 15, played: false });
    expect(members.find((m: { name: string }) => m.name === "Sintético 1")).toMatchObject({ played: true });
  });

  it("playing: a late student joins the smallest team; each question counts once, as 'tournament', and only while it is open", async () => {
    const out = await scenario(async (q, act) => {
      await week(q);
      const [{ t }] = await q(`select private.ensure_tournament($1, $2) as t`, [ids.section1, friday()]);
      await openNow(q, t);
      await act(user(ids.student1b));
      const [{ play }] = await q(`select public.tournament_questions($1) as play`, [t]);
      const [{ resume }] = await q(`select public.tournament_questions($1) as resume`, [t]);
      await act(null);
      const [{ key }] = await q(`select correct_index as key from public.items where id = $1`, [play.questions[0].id]);
      const [member] = await q(`select late, cardinality(item_ids) as n from public.tournament_members where tournament_id = $1 and student_id = $2`, [t, ids.student1b]);
      const sizes = (await q(`select count(*)::int as n from public.tournament_members where tournament_id = $1 group by team_id order by 1`, [t])).map((r) => r.n);
      await act(user(ids.student1b));
      const [{ r }] = await q(`select public.submit_attempt($1, $2::smallint, null, null, 0::smallint, $3, 'tournament') as r`, [play.questions[0].id, key, t]);
      await q("savepoint a");
      const twice = await q(`select public.submit_attempt($1, $2::smallint, null, null, 0::smallint, $3, 'tournament')`, [play.questions[0].id, key, t]).then(() => "ok", async (e) => { await q("rollback to savepoint a"); return (e as Error).message; });
      const notMine = await q(`select public.submit_attempt($1, 0::smallint, null, null, 0::smallint, $2, 'tournament')`, [ids.itemUnverified, t]).then(() => "ok", async (e) => { await q("rollback to savepoint a"); return (e as Error).message; });
      const [{ view }] = await q(`select public.section_tournament($1) as view`, [ids.section1]);
      const [{ after }] = await q(`select public.tournament_questions($1) as after`, [t]);
      await act(null);
      const ctx = await q(`select context from public.attempts where student_id = $1 and session_id = $2`, [ids.student1b, t]);
      const ev = await q(`select props from public.events where actor_id = $1 and name = 'tournament_joined'`, [ids.student1b]);
      // Closed: no more questions, no more answers.
      await q(`update public.tournaments set closes_at = now() - interval '1 minute' where id = $1`, [t]);
      await act(user(ids.student1b));
      const [{ closed }] = await q(`select public.tournament_questions($1) as closed`, [t]);
      await q("savepoint b");
      const late = await q(`select public.submit_attempt($1, 0::smallint, null, null, 0::smallint, $2, 'tournament')`, [play.questions[1].id, t]).then(() => "ok", async (e) => { await q("rollback to savepoint b"); return (e as Error).message; });
      return { play, resume, member, sizes, r, twice, notMine, view, after, ctx, ev, closed, late, t };
    });
    expect(out.play).toMatchObject({ ok: true, total: 10 });
    expect(out.play.questions).toHaveLength(10);
    expect(Object.keys(out.play.questions[0]).sort()).toEqual(["game_public", "id", "kind", "options", "reviewed", "stem"]);
    expect(JSON.stringify(out.play)).not.toContain("correct_index");
    expect(out.resume.questions.map((x: { id: string }) => x.id)).toEqual(out.play.questions.map((x: { id: string }) => x.id));
    expect(out.member).toEqual({ late: true, n: 10 });
    expect(out.sizes).toEqual([4, 5]);   // 4 + 4, and the late student joined one of them
    expect(out.r.is_correct).toBe(true);
    expect(out.twice).toMatch(/already answered/);
    expect(out.notMine).toMatch(/invalid tournament/);
    expect(out.view.tournament.me).toMatchObject({ answered: 1, correct: 1, counted: 1, started: true, team_size: 5 });
    expect(out.after.questions).toHaveLength(9);
    expect(out.ctx).toEqual([{ context: "tournament" }]);
    expect(out.ev).toEqual([{ props: { tournament: out.t } }]);
    expect(out.closed).toEqual({ ok: false, error: "closed" });
    expect(out.late).toMatch(/invalid tournament/);
  });

  it("is only for the section: other students, other teachers and visitors are denied; the tables are not readable", async () => {
    await expectDenied(db, s2, `select public.section_tournament($1)`, [ids.section1], /not your section/);
    await expectDenied(db, t2, `select public.section_tournament_report($1)`, [ids.section1], /not your section/);
    await expectDenied(db, s1, `select public.section_tournament_report($1)`, [ids.section1], /not your section/);
    await expectDenied(db, anon, `select public.section_tournament($1)`, [ids.section1], /permission denied/);
    await expectDenied(db, s1, `select * from public.tournament_members`, [], /permission denied/);
    await expectDenied(db, t1, `select * from public.tournaments`, [], /permission denied/);
    const out = await scenario(async (q, act) => {
      await week(q);
      const [{ t }] = await q(`select private.ensure_tournament($1, $2) as t`, [ids.section1, friday()]);
      await openNow(q, t);
      await act(user(ids.student2));
      await q("savepoint a");
      const outsider = await q(`select public.tournament_questions($1)`, [t]).then(() => "ok", async (e) => { await q("rollback to savepoint a"); return (e as Error).message; });
      return { outsider };
    });
    expect(out.outsider).toMatch(/not your section/);
  });

  it("before Friday it is upcoming; the teacher can turn it off; a recovery code carries the membership", async () => {
    const out = await scenario(async (q, act) => {
      const mates = await week(q);
      await act(user(ids.student1));
      const [{ before }] = await q(`select private.section_tournament_at($1, $2) as before`, [ids.section1, thursday()]);
      await act(null);
      const [{ t }] = await q(`select private.ensure_tournament($1, $2) as t`, [ids.section1, friday()]);
      await openNow(q, t);
      await act(user(mates[0]));
      await q(`select public.tournament_questions($1)`, [t]);
      const [{ code }] = await q(`select public.create_recovery_code() as code`);
      await act(user(ids.newDevice));
      const [{ moved }] = await q(`select public.redeem_recovery_code($1) as moved`, [code]);
      await act(null);
      const [member] = await q(`select count(*)::int as n from public.tournament_members where tournament_id = $1 and student_id = $2`, [t, ids.newDevice]);
      await act(user(ids.teacher1));
      await q(`insert into public.section_settings (section_id, tournament_enabled) values ($1, false)`, [ids.section1]);
      const [{ off }] = await q(`select public.section_tournament_report($1) as off`, [ids.section1]);
      await act(user(ids.student1));
      const [{ offStudent }] = await q(`select public.section_tournament($1) as "offStudent"`, [ids.section1]);
      return { before, moved, member, off, offStudent };
    });
    expect(out.before).toMatchObject({ enabled: true, status: "upcoming", tournament: null });
    expect(out.moved.moved.tournaments).toBe(1);
    expect(out.member.n).toBe(1);
    expect(out.off).toEqual({ enabled: false });
    expect(out.offStudent).toEqual({ enabled: false });
  });
});
