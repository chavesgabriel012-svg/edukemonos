/**
 * Sequential scale for mastery (one hue, light → dark, from the brand violet). Five bins so a
 * teacher can read a cell at a glance; the legend names each bin. No data has its own pattern.
 */
export const MASTERY_BINS = [
  { min: 0, max: 0.3, color: "#ECE8FE", label: "menos de 30 %" },
  { min: 0.3, max: 0.5, color: "#C5BAFB", label: "30–49 %" },
  { min: 0.5, max: 0.7, color: "#9984F8", label: "50–69 %" },
  { min: 0.7, max: 0.85, color: "#6B51F5", label: "70–84 %" },
  { min: 0.85, max: 1.01, color: "#3F25C4", label: "85 % o más" },
] as const;

export function masteryColor(v: number): string {
  return (MASTERY_BINS.find((b) => v >= b.min && v < b.max) ?? MASTERY_BINS[MASTERY_BINS.length - 1]).color;
}

export const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

export function relativeDay(iso: string | null, now: Date): string {
  if (!iso) return "Nunca";
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

export const NO_DATA_STYLE = {
  backgroundColor: "var(--card)",
  backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, var(--border) 4px 5px)",
} as const;
