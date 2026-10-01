import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { SourceEntry } from "@edukemonos/curriculum";
import { ensureDir, paths } from "./cache";
import { PoliteFetcher } from "./polite-fetch";

export interface DownloadMeta {
  sourceId: string;
  url: string;
  sha256: string;
  bytes: number;
  downloadedAt: string;
}

export const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

/**
 * Downloads one source PDF into the local cache. Idempotent: if the file is already there and
 * its hash matches the recorded one, nothing is fetched (unless `force`).
 */
export async function downloadSource(
  entry: SourceEntry,
  { force = false, fetcher = new PoliteFetcher() }: { force?: boolean; fetcher?: PoliteFetcher } = {},
): Promise<DownloadMeta & { fromCache: boolean }> {
  const pdfPath = paths.pdf(entry.id);
  const metaPath = paths.meta(entry.id);
  if (!force && existsSync(pdfPath) && existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as DownloadMeta;
    if (sha256(readFileSync(pdfPath)) === meta.sha256) return { ...meta, fromCache: true };
  }
  const res = await fetcher.fetch(entry.url);
  if (!res.ok) throw new Error(`${entry.id}: HTTP ${res.status} downloading ${entry.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") throw new Error(`${entry.id}: response is not a PDF`);
  writeFileSync(ensureDir(pdfPath), buf);
  const meta: DownloadMeta = {
    sourceId: entry.id,
    url: entry.url,
    sha256: sha256(buf),
    bytes: buf.length,
    downloadedAt: new Date().toISOString(),
  };
  writeFileSync(ensureDir(metaPath), JSON.stringify(meta, null, 2));
  return { ...meta, fromCache: false };
}
