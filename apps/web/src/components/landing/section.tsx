import { cn } from "cn";
import { SHELL } from "@/components/site/page-shell";

const TONE = {
  papel: "bg-background text-foreground",
  card: "bg-card text-foreground",
  tinta: "bg-tinta text-papel",
  violeta: "bg-violeta text-white",
  lima: "bg-lima text-tinta",
} as const;

/** A full-bleed band of the landing with the shared content column inside. */
export function Section({ id, tone = "papel", className, children, labelledBy }: {
  id?: string;
  tone?: keyof typeof TONE;
  className?: string;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn(TONE[tone], "scroll-mt-16")}>
      <div className={cn(SHELL, "py-14 *:min-w-0 sm:py-20", className)}>{children}</div>
    </section>
  );
}

/** Eyebrow + title + lead of a band. `onDark` for Tinta and violet bands. */
export function SectionHeading({ id, eyebrow, title, lead, onDark = false, className }: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl space-y-3", className)}>
      {eyebrow && (
        <p className={cn("font-mono text-xs tracking-wide uppercase", onDark ? "text-lima" : "text-violeta")}>{eyebrow}</p>
      )}
      <h2 id={id} className="font-heading text-[2rem] leading-[1.02] font-bold tracking-tight text-balance sm:text-5xl">{title}</h2>
      {lead && <p className={cn("text-lg leading-relaxed text-pretty", onDark ? "text-papel/80" : "text-muted-foreground")}>{lead}</p>}
    </div>
  );
}

/** A check-list item with the lime tick used across the landing. */
export function Tick({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-lima text-tinta">
        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      </span>
      <span className={onDark ? "text-papel/90" : undefined}>{children}</span>
    </li>
  );
}
