import type pg from "pg";

/**
 * Synthetic fixture data. Inserted as the superuser (no RLS), then each test
 * reads/writes through API roles. Names are clearly fake.
 */
export const ids = {
  admin: "00000000-0000-4000-8000-0000000000a1",
  reviewer: "00000000-0000-4000-8000-0000000000b1",
  teacher1: "00000000-0000-4000-8000-0000000000c1",
  teacher2: "00000000-0000-4000-8000-0000000000c2",
  student1: "00000000-0000-4000-8000-0000000000d1",
  student1b: "00000000-0000-4000-8000-0000000000d3",
  student2: "00000000-0000-4000-8000-0000000000d2",
  loner: "00000000-0000-4000-8000-0000000000d9",
  section1: "00000000-0000-4000-8000-0000000000e1",
  section2: "00000000-0000-4000-8000-0000000000e2",
  source: "00000000-0000-4000-8000-0000000000f1",
  unitPublished: "00000000-0000-4000-8000-000000000101",
  unitDraft: "00000000-0000-4000-8000-000000000102",
  skillPublished: "00000000-0000-4000-8000-000000000201",
  skillDraft: "00000000-0000-4000-8000-000000000202",
  materialPublished: "00000000-0000-4000-8000-000000000301",
  materialDraft: "00000000-0000-4000-8000-000000000302",
  materialOnDraftUnit: "00000000-0000-4000-8000-000000000303",
  itemVerified: "00000000-0000-4000-8000-000000000401",
  itemUnverified: "00000000-0000-4000-8000-000000000402",
  itemOnDraftUnit: "00000000-0000-4000-8000-000000000403",
  itemDraft: "00000000-0000-4000-8000-000000000404",
  tutorSession1: "00000000-0000-4000-8000-000000000501",
  tutorSession2: "00000000-0000-4000-8000-000000000502",
  diagnostic1: "00000000-0000-4000-8000-000000000601",
} as const;

export interface Fixture {
  joinCode1: string;
  joinCode2: string;
}

export async function loadFixture(db: pg.Client): Promise<Fixture> {
  await db.query(
    `insert into auth.users (id, email, is_anonymous) values
       ($1, 'admin@example.test', false),
       ($2, 'reviewer@example.test', false),
       ($3, 'teacher1@example.test', false),
       ($4, 'teacher2@example.test', false),
       ($5, null, true), ($6, null, true), ($7, null, true), ($8, null, true)`,
    [
      ids.admin, ids.reviewer, ids.teacher1, ids.teacher2,
      ids.student1, ids.student1b, ids.student2, ids.loner,
    ],
  );
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ids.admin]);
  await db.query(`update public.profiles set role = 'reviewer' where id = $1`, [ids.reviewer]);

  await db.query(
    `insert into public.students (id, declared_grade_id) values ($1, 7), ($2, 7), ($3, 7), ($4, 8)`,
    [ids.student1, ids.student1b, ids.student2, ids.loner],
  );
  await db.query(
    `insert into public.sections (id, teacher_id, name, grade_id, current_term) values
       ($1, $2, '7-1 (prueba)', 7, 1),
       ($3, $4, '7-2 (prueba)', 7, 1)`,
    [ids.section1, ids.teacher1, ids.section2, ids.teacher2],
  );
  await db.query(
    `insert into public.section_members (section_id, student_id, display_name, consent_at) values
       ($1, $2, 'Estudiante Sintético Uno', now()),
       ($1, $3, 'Estudiante Sintético Uno B', now()),
       ($4, $5, 'Estudiante Sintético Dos', now())`,
    [ids.section1, ids.student1, ids.student1b, ids.section2, ids.student2],
  );

  await db.query(
    `insert into public.curriculum_sources (id, source_key, kind, subject_id, cycle_id, title, url)
     values ($1, 'test-source', 'program', 'matematicas', 'III', 'Fuente de prueba', 'https://www.mep.go.cr/sites/default/files/media/matematica.pdf')`,
    [ids.source],
  );
  await db.query(
    `insert into public.curriculum_units
       (id, cycle_id, grade_id, subject_id, title, source_id, source_page, source_excerpt, status)
     values
       ($1, 'III', 7, 'matematicas', 'Unidad publicada', $3, 10, 'extracto', 'published'),
       ($2, 'III', 7, 'matematicas', 'Unidad borrador', $3, 11, 'extracto', 'draft')`,
    [ids.unitPublished, ids.unitDraft, ids.source],
  );
  await db.query(
    `insert into public.skills (id, unit_id, subject_id, grade_id, code, name) values
       ($1, $2, 'matematicas', 7, '1.1', 'Habilidad publicada'),
       ($3, $4, 'matematicas', 7, '1.2', 'Habilidad borrador')`,
    [ids.skillPublished, ids.unitPublished, ids.skillDraft, ids.unitDraft],
  );
  await db.query(
    `insert into public.materials (id, unit_id, kind, content, status) values
       ($1, $2, 'summary', 'resumen publicado', 'published'),
       ($3, $2, 'summary', 'resumen borrador', 'draft'),
       ($4, $5, 'summary', 'resumen en unidad borrador', 'published')`,
    [ids.materialPublished, ids.unitPublished, ids.materialDraft, ids.materialOnDraftUnit, ids.unitDraft],
  );
  const opts = ["a", "b", "c", "d"];
  await db.query(
    `insert into public.items (id, unit_id, stem, options, correct_index, explanation,
                               distractor_explanations, difficulty, verified, status) values
       ($1, $5, 'verificado', $6, 2, 'porque c', $7, 3, true, 'published'),
       ($2, $5, 'no verificado', $6, 1, 'porque b', $7, 3, false, 'published'),
       ($3, $8, 'en unidad borrador', $6, 0, 'porque a', $7, 3, true, 'published'),
       ($4, $5, 'item borrador', $6, 0, 'porque a', $7, 3, true, 'draft')`,
    [
      ids.itemVerified, ids.itemUnverified, ids.itemOnDraftUnit, ids.itemDraft,
      ids.unitPublished, opts, ["x", "x", "x", "x"], ids.unitDraft,
    ],
  );

  await db.query(
    `insert into public.attempts (student_id, item_id, is_correct) values ($1, $3, true), ($2, $3, false)`,
    [ids.student1, ids.student2, ids.itemVerified],
  );
  await db.query(
    `insert into public.mastery (student_id, skill_id, score) values ($1, $3, 0.8), ($2, $3, 0.3)`,
    [ids.student1, ids.student2, ids.skillPublished],
  );
  await db.query(
    `insert into public.diagnostics (id, student_id, subject_id, grade_id) values
       ($1, $2, 'matematicas', 7), (gen_random_uuid(), $3, 'matematicas', 7)`,
    [ids.diagnostic1, ids.student1, ids.student2],
  );
  await db.query(
    `insert into public.tutor_sessions (id, student_id, unit_id, topic) values
       ($1, $2, $4, 'potencias'), ($3, $5, $4, 'divisibilidad')`,
    [ids.tutorSession1, ids.student1, ids.tutorSession2, ids.unitPublished, ids.student2],
  );
  await db.query(
    `insert into public.tutor_messages (session_id, role, content) values
       ($1, 'user', 'mensaje privado uno'), ($2, 'user', 'mensaje privado dos')`,
    [ids.tutorSession1, ids.tutorSession2],
  );
  await db.query(
    `insert into public.writing_feedback (student_id, category, count) values ($1, 'tildes', 2), ($2, 'b_v', 1)`,
    [ids.student1, ids.student2],
  );
  await db.query(
    `insert into public.reports (reporter_id, target_type, target_id, comment) values ($1, 'material', $2, 'error')`,
    [ids.student1, ids.materialPublished],
  );
  await db.query(
    `insert into public.ai_usage (provider, model, purpose, success) values ('test', 'test-model', 'tutor', true)`,
  );

  const codes = await db.query<{ id: string; join_code: string }>(
    `select id, join_code from public.sections order by id`,
  );
  const code = (id: string) => codes.rows.find((r) => r.id === id)!.join_code;
  return { joinCode1: code(ids.section1), joinCode2: code(ids.section2) };
}
