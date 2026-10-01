import { expect, test } from "@playwright/test";
import pg from "pg";

const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const EMAIL = `revisor-${Date.now()}@example.test`;

async function sql<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** Reads the newest magic link sent to EMAIL from the local Mailpit inbox. */
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

test("a reviewer signs in, fixes an unverified unit and publishes it", async ({ page }) => {
  // 1. Sign in with a magic link.
  await page.goto("/revisar");
  await expect(page).toHaveURL(/\/entrar\?next=%2Frevisar/);
  await page.getByLabel("Correo electrónico").fill(EMAIL);
  await page.getByRole("button", { name: "Enviarme el enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Abre el enlace");
  await page.goto(await magicLink());

  // 2. A fresh account is a teacher, not a reviewer: no data is shown.
  await expect(page.getByRole("heading", { name: "Necesitas permiso de revisor" })).toBeVisible();
  await sql(`update public.profiles set role = 'reviewer' where id = (select id from auth.users where email = $1)`, [EMAIL]);

  // 3. The list shows the loaded drafts and flags the one with an invented skill.
  await page.goto("/revisar?materia=matematicas&grado=7");
  await expect(page.getByText("Números naturales: operaciones y combinación de operaciones")).toBeVisible();
  const flagged = page.getByRole("link", { name: /Teoría de números/ });
  await expect(flagged).toContainText("1 por verificar");

  // 4. Publishing is refused while the invented skill is there.
  await flagged.click();
  await expect(page.getByText("Página 277", { exact: true })).toBeVisible(); // official text shown alongside
  await page.getByRole("button", { name: "Publicar para estudiantes" }).click();
  await expect(page.getByText(/No se puede publicar: 1 problema/)).toBeVisible();

  // 5. The reviewer removes it, saves (re-verified), and publishes.
  const skills = page.getByLabel(/Habilidades/);
  const kept = (await skills.inputValue()).split("\n").filter((l) => !l.includes("números complejos")).join("\n");
  await skills.fill(kept);
  await page.getByRole("button", { name: "Guardar y verificar" }).click();
  await expect(page.getByRole("status")).toContainText("Cambios guardados");
  await expect(page.getByRole("heading", { name: /Por verificar/ })).toHaveCount(0);

  // A paraphrased excerpt is caught on save.
  await page.getByLabel(/Extracto textual/).fill("Las operaciones se limitan a cuatro términos.");
  await page.getByRole("button", { name: "Guardar y verificar" }).click();
  await expect(page.getByRole("heading", { name: /Por verificar \(1\)/ })).toBeVisible();
  await page.getByLabel(/Extracto textual/).fill("La combinación de operaciones no debe exceder de cuatro términos");
  await page.getByRole("button", { name: "Guardar y verificar" }).click();
  await expect(page.getByRole("heading", { name: /Por verificar/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Publicar para estudiantes" }).click();
  await expect(page.getByText("Estado: Publicada")).toBeVisible();

  // 6. Everything is in the review log, and the unit is now public.
  const log = await sql<{ action: string }>(
    `select action from public.review_log where entity_id = (select id from public.curriculum_units where title = 'Teoría de números') order by created_at`,
  );
  expect(log.map((r) => r.action)).toEqual(["edit", "edit", "edit", "publish"]);
  const skillsLeft = await sql<{ name: string }>(
    `select name from public.skills where unit_id = (select id from public.curriculum_units where title = 'Teoría de números')`,
  );
  expect(skillsLeft.map((s) => s.name)).toEqual(["Aplicar el algoritmo de la división en la resolución de problemas."]);
});
