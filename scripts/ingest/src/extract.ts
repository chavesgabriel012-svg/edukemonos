import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureDir, paths } from "./cache";

export interface PageTexts {
  sourceId: string;
  sha256: string;
  extractedWith: string;
  /** 1-indexed page number -> text. */
  pages: Record<string, string>;
}

/** Version string of the local pdftotext (poppler-utils), recorded with every extraction. */
export function pdftotextVersion(): string {
  const r = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
  if (r.error) throw new Error("pdftotext is not installed (apt install poppler-utils / brew install poppler)");
  const line = `${r.stdout}\n${r.stderr}`.split("\n").find((l) => l.startsWith("pdftotext"));
  return line?.trim() ?? "pdftotext";
}

/**
 * Extracts every page with pdftotext in its default (reading-order) mode, which keeps table
 * columns as separate blocks instead of interleaving them line by line like `-layout` does.
 * Cached per PDF hash.
 */
export function extractPages(sourceId: string, pdfSha256: string): PageTexts {
  const out = paths.pages(sourceId);
  if (existsSync(out)) {
    const cached = JSON.parse(readFileSync(out, "utf8")) as PageTexts;
    if (cached.sha256 === pdfSha256) return cached;
  }
  const extractedWith = `${pdftotextVersion()} (default mode)`;
  const text = execFileSync("pdftotext", ["-enc", "UTF-8", paths.pdf(sourceId), "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const split = text.split("\f");
  if (split.at(-1)?.trim() === "") split.pop();
  const pages: Record<string, string> = {};
  split.forEach((t, i) => (pages[String(i + 1)] = t));
  const result: PageTexts = { sourceId, sha256: pdfSha256, extractedWith, pages };
  writeFileSync(ensureDir(out), JSON.stringify(result));
  return result;
}

export function pageMap(texts: PageTexts, from: number, to: number): Map<number, string> {
  const map = new Map<number, string>();
  for (let p = from; p <= to; p++) {
    const t = texts.pages[String(p)];
    if (t !== undefined) map.set(p, t);
  }
  return map;
}
