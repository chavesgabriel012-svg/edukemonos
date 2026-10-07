import type { SectionMetrics } from "@edukemonos/curriculum";
import { cn } from "cn";

/** Headline numbers. */
export function StatTiles({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-[22px] border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{i.label}</dt>
          <dd className="mt-1 font-heading text-3xl leading-none font-bold">{i.value}</dd>
          {i.hint && <dd className="mt-1.5 text-xs text-muted-foreground">{i.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Hover/focus tooltip for a chart mark (CSS only, so it works in server components). */
export function Tip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span role="tooltip"
      className={cn("pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-tinta px-2.5 py-1.5 text-xs leading-snug text-papel shadow-lg group-hover:block group-focus-visible:block", className)}>
      {children}
    </span>
  );
}

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Exercises per day over the last 4 weeks: one series, so no legend; the title names it. */
export function ActivityBars({ activity, label = "Ejercicios respondidos por día" }: { activity: SectionMetrics["activity"]; label?: string }) {
  const max = Math.max(1, ...activity.map((a) => a.attempts));
  const total = activity.reduce((a, d) => a + d.attempts, 0);
  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{total} en 4 semanas</span>
      </figcaption>
      <div className="flex h-28 items-end gap-[2px] border-b border-border" aria-hidden>
        {activity.map((d) => (
          <div key={d.day} tabIndex={-1} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-violeta transition group-hover:bg-tinta"
              style={{ height: d.attempts ? `${Math.max(4, (d.attempts / max) * 100)}%` : 0 }} />
            <Tip>{dayLabel(d.day)}: {d.attempts} ejercicios{d.tutor ? ` · ${d.tutor} con Kemo` : ""}</Tip>
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>{dayLabel(activity[0].day)}</span>
        <span>Hoy</span>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{activity.map((d) => <tr key={d.day}><th>{d.day}</th><td>{d.attempts}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars with a direct value label: one series, ranked. */
export function BarList({ rows, unit = "", empty }: { rows: { key: string; label: React.ReactNode; value: number; note?: string }[]; unit?: string; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 font-mono text-xs">{r.value}{unit}{r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary">
            <div className="h-full rounded-full bg-violeta" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A 0–100 % mastery bar with its value. */
export function MasteryBar({ value }: { value: number | null }) {
  if (value === null) return <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">Sin datos</span>;
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-violeta" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="font-mono text-xs">{Math.round(value * 100)} %</span>
    </span>
  );
}
