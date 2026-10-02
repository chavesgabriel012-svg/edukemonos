/**
 * Eduka brand tokens (manual de marca v1, octubre 2026). The CSS side lives in `app/globals.css`;
 * these mirror it for places that need the raw values (icons, OG images, per-subject styles).
 */
export const brand = {
  violeta: "#5B3DF5",
  lima: "#C6F432",
  tinta: "#17132A",
  papel: "#F6F5F9",
} as const;

/**
 * Background for a subject id (the `--subject-*` tokens in globals.css), falling back to the neutral
 * surface for unknown ids. Text on top is always Tinta.
 */
export function subjectColor(id: string): string {
  return `var(--subject-${id}, var(--muted))`;
}
