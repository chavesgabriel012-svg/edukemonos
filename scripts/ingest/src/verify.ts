/**
 * Re-verifies every source in sources.json without downloading bodies: HTTP status,
 * size against the manifest, and robots.txt. Blocked or missing sources are listed so
 * they can go to docs/sources-manual.md for manual download.
 *
 * Usage: pnpm sources:verify
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { manifestSchema } from "@edukemonos/curriculum";
import { PoliteFetcher, RobotsBlockedError } from "./polite-fetch";

const manifest = manifestSchema.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "sources.json"), "utf8")),
);
const fetcher = new PoliteFetcher();
const problems: string[] = [];
let sizeUnknown = 0;

for (const source of manifest.sources) {
  try {
    const res = await fetcher.fetch(source.url, { method: "HEAD" });
    const length = Number(res.headers.get("content-length") ?? NaN);
    const sizeNote = Number.isNaN(length) ? "size unknown" : length === source.bytes ? "size ok" : `SIZE CHANGED ${source.bytes} -> ${length}`;
    if (Number.isNaN(length)) sizeUnknown++;
    console.log(`${res.status} ${source.id} (${sizeNote})`);
    if (!res.ok) problems.push(`${source.id}: HTTP ${res.status} ${source.url}`);
    else if (sizeNote.startsWith("SIZE")) problems.push(`${source.id}: ${sizeNote}`);
  } catch (error) {
    const reason = error instanceof RobotsBlockedError ? "blocked by robots.txt" : (error as Error).message;
    console.log(`ERR ${source.id}: ${reason}`);
    problems.push(`${source.id}: ${reason} ${source.url}`);
  }
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exitCode = 1;
} else {
  const unknown = sizeUnknown ? ` ${sizeUnknown} without Content-Length, so size could not be compared (the downloader checks sha256).` : " Sizes match.";
  console.log(`\nAll ${manifest.sources.length} sources reachable.${unknown}`);
}
