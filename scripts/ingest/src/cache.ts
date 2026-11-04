import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Local working files (git-ignored). Official PDFs are re-downloadable, never committed. */
export const CACHE_DIR = process.env.INGEST_CACHE_DIR ?? join(import.meta.dirname, "..", ".cache");

export const paths = {
  pdf: (id: string) => join(CACHE_DIR, "pdf", `${id}.pdf`),
  meta: (id: string) => join(CACHE_DIR, "meta", `${id}.json`),
  pages: (id: string) => join(CACHE_DIR, "text", `${id}.json`),
  extraction: (id: string, grade: number) => join(CACHE_DIR, "units", `${id}-g${grade}.json`),
  content: (unitId: string) => join(CACHE_DIR, "content", `${unitId}.json`),
  contentSteps: (unitId: string) => join(CACHE_DIR, "content", `${unitId}.steps.json`),
  games: (unitId: string) => join(CACHE_DIR, "games", `${unitId}.json`),
  /** Versioned copy of the generated pieces (scripts/ingest/generated/games): paid content survives a lost cache. */
  gamesArchive: (unitId: string) => join(import.meta.dirname, "..", "generated", "games", `${unitId}.json`),
  gameSteps: (unitId: string) => join(CACHE_DIR, "games", `${unitId}.steps.json`),
};

export function ensureDir(file: string): string {
  mkdirSync(dirname(file), { recursive: true });
  return file;
}
