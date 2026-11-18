import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * The core loop between a teacher and a student, against the local Supabase from e2e/setup.sh:
 * the teacher signs in and creates a section, a student joins with its code and practises, and
 * the teacher sees that student in the panel. No AI calls.
 */
const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const EMAIL = `docente-${Date.now()}@example.test`;
const STUDENT = "Ana Prueba";

async function sql<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

async function magicLink(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL}`)}`);
    const list = (await res.json()) as { messages: { ID: string }[] };
    if (list.messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()) as { HTML: string; Text: string };
      const href = (msg.HTML || msg.Text).match(/https?:\/\/[^"'\s<>]+verify[^"'\s<>]*/)?.[0];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("magic link e-mail not received");
}

/** A published 7.º unit with four verified exercises, so the student has something to practise. */
async function practiceUnit(): Promise<string> {
  const [unit] = await sql<{ id: string; skill: string }>(`
    select u.id, s.id as skill from public.curriculum_units u join public.skills s on s.unit_id = u.id
    where u.grade_id = 7 order by u.sort_order, s.id limit 1`);
  if (!unit) throw new Error("no 7.º unit with skills: run e2e/setup.sh first");
  await sql(`update public.curriculum_units set status = 'published' where id = $1`, [unit.id]);
  const verified = await sql(`select 1 from public.items where unit_id = $1 and status = 'published' and verified`, [unit.id]);
  for (let k = verified.length; k < 4; k++) {
    await sql(
      `insert into public.items (unit_id, skill_ids, kind, stem, options, correct_index, explanation, difficulty, verified, status)
       values ($1, array[$2]::uuid[], 'single_choice', $3, array['1','2','3','4'], 1, 'Porque sí.', 2, true, 'published')`,
      [unit.id, unit.skill, `¿Cuánto es 1 + 1? (${k + 1})`],
    );
  }
  return unit.id;
}

test("a teacher creates a section, a student joins and practises, and the teacher sees them", async ({ browser }) => {
  const unitId = await practiceUnit();

  const teacher = await (await browser.newContext()).newPage();
  await teacher.goto("/entrar?next=/docente");
  await teacher.getByRole("textbox").fill(EMAIL);
  await teacher.getByRole("button", { name: /enviar|entrar|enlace/i }).click();
  await teacher.goto(await magicLink());
  await teacher.goto("/docente");
  await expect(teacher.getByText("Todavía no tiene secciones")).toBeVisible();

  await teacher.getByLabel("Nombre de la sección").fill("7-3 Prueba");
  await teacher.getByRole("button", { name: "Crear sección" }).click();
  await teacher.waitForURL(/\/docente\/seccion\//);
  await expect(teacher.getByRole("heading", { name: "Todavía no hay estudiantes" })).toBeVisible();
  // Nothing to show about goals, tournaments or streaks before anyone joins.
  await expect(teacher.getByRole("heading", { name: "Torneo de los viernes" })).toHaveCount(0);
  const code = (await teacher.locator('[aria-label^="Código"]').first().innerText()).trim();

  const student = await (await browser.newContext()).newPage();
  await student.goto("/unirme");
  await student.getByLabel(/Código/).fill(code);
  await student.getByLabel("Tu nombre").fill(STUDENT);
  await student.getByRole("checkbox").check();
  await student.getByRole("button", { name: "Unirme" }).click();
  await expect(student.getByText("¡Ya estás en la sección 7-3 Prueba!")).toBeVisible();

  await student.goto(`/unidad/${unitId}?tab=practicar`);
  for (let k = 0; k < 3; k++) {
    await student.locator("fieldset label").nth(1).click();
    await student.getByRole("button", { name: "Revisar respuesta" }).click();
    await student.getByRole("button", { name: "Siguiente ejercicio" }).click();
  }

  await teacher.reload();
  await expect(teacher.getByText(STUDENT).first()).toBeVisible();
  await expect(teacher.getByRole("heading", { name: "Torneo de los viernes" })).toBeVisible();
});
