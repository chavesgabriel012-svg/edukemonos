import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * The whole loop of the Eduka team console, through the real UI, against the local Supabase from
 * e2e/setup.sh: the team creates a school and offers 7.º Matemáticas and invites two people; the
 * coordination approves the subject and creates a group; the team opens the school; a teacher
 * creates a section; a student joins with the group's code and practises; the coordination hides a
 * topic; a school that is not active refuses its code; an account nobody invited sees nothing, and
 * once invited it is linked on its next visit to /docente, with the session it already had.
 * SQL is used only to make the team account an admin and to publish a 7.º unit with verified items.
 * No AI calls.
 */
const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const RUN = Date.now();
const ADMIN = `equipo-${RUN}@example.test`;
const DOCENTE = `docente-${RUN}@example.test`;
const COORD = `coord-${RUN}@example.test`;
const SIN_INVITACION = `sin-invitacion-${RUN}@example.test`;
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

/** The link in the newest e-mail sent to `email` in the local Mailpit inbox (magic link or invitation). */
async function mailLink(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = (await res.json()) as { messages: { ID: string }[] };
    if (list.messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()) as { HTML: string; Text: string };
      const href = (msg.HTML || msg.Text).match(/https?:\/\/[^"'\s<>]+(?:verify|auth\/confirm)[^"'\s<>]*/)?.[0];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no link e-mail received for ${email}`);
}

/** Signs in with a magic link requested from /entrar. */
async function signIn(page: Page, email: string, next: string) {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Abra el enlace");
  await page.goto(await mailLink(email));
}

/** A published 7.º unit with four verified exercises, so the student has something to practise. */
async function practiceUnit(): Promise<string> {
  const [unit] = await sql<{ id: string; skill: string }>(`
    select u.id, s.id as skill from public.curriculum_units u join public.skills s on s.unit_id = u.id
    where u.grade_id = 7 and u.subject_id = 'matematicas' order by u.sort_order, s.id limit 1`);
  if (!unit) throw new Error("no 7.º Matemáticas unit with skills: run e2e/setup.sh first");
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

/** Saves the school's state from the team console (Resumen tab). */
async function setStatus(admin: Page, schoolUrl: string, label: "Preparando" | "Activo") {
  await admin.goto(`${schoolUrl}?tab=resumen`);
  await admin.getByLabel("Estado").selectOption({ label });
  await admin.getByRole("button", { name: "Guardar colegio" }).click();
  await admin.waitForURL(/\/admin\/colegios\//);
  await admin.goto(`${schoolUrl}?tab=resumen`);
  await expect(admin.getByLabel("Estado")).toHaveValue(label.toLowerCase());
}

async function join(browser: import("@playwright/test").Browser, code: string, name: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/unirme");
  await page.getByLabel(/Código/).fill(code);
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Unirme" }).click();
  return page;
}

test("the console loop: a new school, its people, its program, a section, a student practising", async ({ browser }) => {
  test.setTimeout(420_000);
  const unitId = await practiceUnit();
  const [{ title: unitTitle }] = await sql<{ title: string }>(`select title from public.curriculum_units where id = $1`, [unitId]);

  // 1. The team signs in (magic link), is made admin, creates the school, offers 7.º Matemáticas and invites two people.
  const admin = await (await browser.newContext()).newPage();
  admin.setDefaultTimeout(120_000);
  await signIn(admin, ADMIN, "/docente");
  await sql(`update public.profiles set role = 'admin' where id = (select id from auth.users where email = $1)`, [ADMIN]);
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Colegios" })).toBeVisible();
  await admin.getByLabel("Nombre del colegio").fill("Colegio Prueba");
  await admin.getByRole("button", { name: "Crear colegio" }).click();
  await admin.waitForURL(/\/admin\/colegios\/[0-9a-f-]{36}/);
  const schoolId = admin.url().match(/colegios\/([0-9a-f-]{36})/)![1];
  const schoolUrl = `/admin/colegios/${schoolId}`;
  await expect(admin.getByRole("heading", { name: "Colegio Prueba" }).first()).toBeVisible();

  await admin.goto(`${schoolUrl}?tab=programa`);
  await admin.locator('[data-cell="7-matematicas"]').getByRole("checkbox").click();
  await expect(admin.locator('[data-cell="7-matematicas"]')).toContainText("Pendiente de aprobación");

  await admin.goto(`${schoolUrl}?tab=personas`);
  await admin.getByLabel("Personas que va a invitar").fill(`${DOCENTE}, Dana Docente\n${COORD}, Cora Coordinación, coordinación`);
  await admin.getByRole("button", { name: "Revisar lista" }).click();
  await expect(admin.getByText("2 personas listas")).toBeVisible();
  await admin.getByRole("button", { name: "Enviar invitaciones" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "2 invitaciones enviadas." })).toBeVisible();

  // 2. Cora opens her invitation, lands on /docente, follows the call to review the program, approves
  //    7.º Matemáticas and creates the group 7-1.
  const cora = await (await browser.newContext()).newPage();
  cora.setDefaultTimeout(120_000);
  await cora.goto(await mailLink(COORD));
  await cora.waitForURL(/\/docente$/);
  await expect(cora.getByText("Su colegio está terminando de preparar Eduka.")).toHaveCount(0);
  await cora.getByRole("link", { name: /Revise y apruebe el programa de su colegio/ }).click();
  await cora.waitForURL(new RegExp(`/docente/institucion/${schoolId}$`));
  await expect(cora.getByRole("heading", { name: "Colegio Prueba" })).toBeVisible();
  const offering = cora.getByRole("listitem").filter({ has: cora.getByRole("heading", { name: "7.º Matemáticas" }) });
  await expect(offering).toContainText("Pendiente de aprobación");
  await offering.getByRole("button", { name: "Aprobar", exact: true }).click();
  await expect(offering).toContainText("Aprobada");
  await cora.getByLabel("Nombres de los grupos").fill("7-1");
  await cora.getByRole("button", { name: "Crear grupos" }).click();
  await expect(cora.getByText("Se creó 1 grupo.")).toBeVisible();

  // 3. The team makes the school active; Dana opens her invitation and creates the section 7-1 · Matemáticas.
  await setStatus(admin, schoolUrl, "Activo");
  const dana = await (await browser.newContext()).newPage();
  dana.setDefaultTimeout(120_000);
  await dana.goto(await mailLink(DOCENTE));
  await dana.goto("/docente");
  await expect(dana.getByText("Su colegio todavía no le dio acceso a Eduka")).toHaveCount(0);
  await dana.locator('select[name="group_id"]').selectOption({ label: "7-1 (7.º)" });
  await dana.locator('select[name="subject_id"]').selectOption({ label: "Matemáticas" });
  await dana.getByRole("button", { name: "Crear sección" }).click();
  await dana.waitForURL(/\/docente\/seccion\//);
  const sectionUrl = dana.url();
  const code = (await dana.locator('[aria-label^="Código"]').first().innerText()).trim();

  // 4. A student joins with the group's code and sees only 7.º and Matemáticas; she practises and Dana sees her.
  const student = await join(browser, code, STUDENT);
  await expect(student.getByText("¡Ya estás en el grupo 7-1!")).toBeVisible();
  await student.goto("/estudiar");
  await expect(student.locator('main a[href="/estudiar/7"]')).toBeVisible();
  await expect(student.locator('main a[href="/estudiar/8"]')).toHaveCount(0);
  await expect(student.locator('main a[href="/estudiar/9"]')).toHaveCount(0);
  await student.goto("/estudiar/7");
  const subjectLinks = student.locator('main a[href^="/estudiar/7/"]');
  await expect(subjectLinks).toHaveCount(1);
  await expect(subjectLinks.first()).toContainText("Matemáticas");

  await student.goto(`/unidad/${unitId}?tab=practicar`);
  for (let k = 0; k < 3; k++) {
    await student.locator("fieldset label").nth(1).click();
    await student.getByRole("button", { name: "Revisar respuesta" }).click();
    await student.getByRole("button", { name: "Siguiente ejercicio" }).click();
  }
  await dana.goto(sectionUrl);
  await expect(dana.getByText(STUDENT).first()).toBeVisible();

  // 5. Cora hides the topic: the student gets a 404 on it.
  await cora.goto(`/docente/institucion/${schoolId}`);
  const approved = cora.getByRole("listitem").filter({ has: cora.getByRole("heading", { name: "7.º Matemáticas" }) });
  await approved.getByText("Ver los temas").click();
  const topic = approved.getByRole("listitem").filter({ hasText: unitTitle });
  await topic.getByRole("button", { name: "Ocultar" }).click();
  await expect(topic).toContainText("Oculto para Kemo");
  // The page streams behind a loading state, so the 404 arrives as the not-found page (the status line is already 200).
  await student.goto(`/unidad/${unitId}`);
  await expect(student.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await expect(student.getByText("Error 404")).toBeVisible();
  await expect(student.locator("main").getByText(unitTitle)).toHaveCount(0);

  // 6. With the school not active, its group code is refused with the exact text.
  await setStatus(admin, schoolUrl, "Preparando");
  const late = await join(browser, code, "Luis Prueba");
  await expect(late.locator("main").getByRole("alert")).toHaveText("Tu colegio todavía no abre Eduka para estudiantes. Pregúntale a tu docente.");

  // 7. An account nobody invited sees the exact text and has no section form.
  const nobody = await (await browser.newContext()).newPage();
  await signIn(nobody, SIN_INVITACION, "/docente");
  await nobody.goto("/docente");
  await expect(nobody.getByText("Su colegio todavía no le dio acceso a Eduka. Si ya debería tenerlo, pídale a la coordinación que lo invite.")).toBeVisible();
  await expect(nobody.getByRole("button", { name: "Crear sección" })).toHaveCount(0);
  await expect(nobody.locator('select[name="subject_id"]')).toHaveCount(0);

  // 8. Invited afterwards, with the session already open: /docente links them without a new sign-in.
  await admin.goto(`${schoolUrl}?tab=personas`);
  await admin.getByLabel("Personas que va a invitar").fill(`${SIN_INVITACION}, Nico Tarde`);
  await admin.getByRole("button", { name: "Revisar lista" }).click();
  await expect(admin.getByText("1 persona lista")).toBeVisible();
  await admin.getByRole("button", { name: "Enviar invitaciones" }).click();
  await expect(admin.getByRole("status").filter({ hasText: "Ya tiene cuenta en Eduka" })).toBeVisible();
  await nobody.goto("/docente");
  await expect(nobody.getByText("Su colegio todavía no le dio acceso a Eduka")).toHaveCount(0);
  await expect(nobody.getByRole("link", { name: /Colegio Prueba/ })).toBeVisible();
});
