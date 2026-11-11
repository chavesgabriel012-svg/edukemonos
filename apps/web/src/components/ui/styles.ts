/** Shared surface and form classes, so every page uses the same radii, borders and focus ring. */

/** Card: radius 22 px (brand manual). */
export const card = "rounded-[22px] border bg-card p-5 sm:p-6";

/** Small label in Geist Mono: «MATEMÁTICAS · 7.º», «PASO 1». */
export const eyebrow = "font-mono text-xs tracking-wide text-muted-foreground uppercase";

const control =
  "w-full rounded-[14px] border border-input bg-card px-3.5 text-base outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-violeta focus-visible:ring-3 focus-visible:ring-violeta/20 disabled:opacity-60";

/** One-line input, as tall as a button (52 px). */
export const field = `${control} h-[52px]`;

/** Multi-line input. */
export const textarea = `${control} py-3 leading-relaxed`;

/** Text link inside copy. */
export const link = "font-medium underline decoration-violeta/40 underline-offset-2 hover:decoration-violeta";
