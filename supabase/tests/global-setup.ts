import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";

const here = import.meta.dirname;
const dbName = `edukemonos_test_${process.pid}`;

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Creates a fresh database with the Supabase shim, every migration and the seed. */
export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Run: eval \"$(supabase/tests/start-local-pg.sh)\"",
    );
  }
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  const migrationsDir = join(here, "..", "migrations");
  const files = [
    join(here, "supabase-shim.sql"),
    ...readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(migrationsDir, f)),
    join(here, "..", "seed.sql"),
  ];
  for (const file of files) {
    try {
      await db.query(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`Failed applying ${file}: ${(error as Error).message}`);
    }
  }
  await db.end();
  project.provide("databaseUrl", url.toString());

  return async () => {
    await admin.query(`drop database if exists ${dbName} with (force)`);
    await admin.end();
  };
}
