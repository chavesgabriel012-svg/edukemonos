import type { FullConfig } from "@playwright/test";

const LOCAL = /^(127\.0\.0\.1|localhost)$/;
const HOW = "Start the app with e2e/dev.sh (after e2e/setup.sh); never with plain `pnpm dev` while production keys are exported.";

function requireLocal(name: string, url: string) {
  if (!LOCAL.test(new URL(url).hostname)) throw new Error(`${name} (${url}) is not local. End-to-end tests only run against 127.0.0.1 or localhost.`);
}

/** Refuses to run unless every target is local, including the Supabase URL the running app was built with. */
export default async function globalSetup(config: FullConfig) {
  const base = config.projects[0].use.baseURL ?? "http://127.0.0.1:3000";
  requireLocal("baseURL / E2E_BASE_URL", base);
  requireLocal("E2E_DB_URL", process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres");
  requireLocal("E2E_MAILPIT_URL", process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324");

  const res = await fetch(`${base}/entrar`);
  const html = await res.text();
  const chunks = [...html.matchAll(/(?:src|href)="([^"]+\.js[^"]*)"/g)].map((m) => new URL(m[1], base).href);
  for (const [name, text] of [["/entrar", html] as const, ...(await Promise.all(chunks.map(async (c) => [c, await (await fetch(c)).text()] as const)))]) {
    if (/\.supabase\.co/.test(text)) throw new Error(`The app at ${base} talks to a hosted Supabase (".supabase.co" found in ${name}). ${HOW}`);
  }
}
