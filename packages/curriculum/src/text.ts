/**
 * Text normalisation for verbatim checks against the official PDFs.
 *
 * pdftotext output differs from what a model (or a reviewer) copies: line-break hyphenation
 * ("operacio-\nnes"), bullet glyphs from private-use fonts, ligatures, curly quotes and
 * irregular spacing. Normalising both sides lets us check "does this excerpt really appear on
 * that page?" without accepting paraphrases.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[­]/g, "") // soft hyphen
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2") // word split across lines
    .replace(/[-•▪●‣⁃◦]/g, " ") // bullets / private-use glyphs
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—‒−]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `needle` appears verbatim (after normalisation) in `haystack`. */
export function appearsVerbatim(needle: string, haystack: string): boolean {
  const n = normalizeForMatch(needle);
  return n.length > 0 && normalizeForMatch(haystack).includes(n);
}

/**
 * Looks for `needle` on `page` and, to tolerate text that continues onto the next page, on the
 * concatenation of `page` and `page + 1`. Returns the page where it starts, or null.
 */
export function findOnPage(needle: string, pages: Map<number, string>, page: number): number | null {
  const here = pages.get(page);
  if (here === undefined) return null;
  if (appearsVerbatim(needle, here)) return page;
  const next = pages.get(page + 1);
  if (next !== undefined && appearsVerbatim(needle, `${here}\n${next}`)) return page;
  return null;
}
