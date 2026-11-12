import { cn } from "cn";
import { Reveal } from "@/components/landing/reveal";
import { SHELL } from "@/components/site/page-shell";

const TONE = {
  papel: "bg-background text-foreground",
  card: "bg-card text-foreground",
  tinta: "bg-tinta text-papel",
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
      <Reveal className={cn(SHELL, "py-14 *:min-w-0 sm:py-20", className)}>{children}</Reveal>
    </section>
  );
}

/** Title and one sentence of a band. `onDark` for the Tinta band. */
export function SectionHeading({ id, title, lead, onDark = false }: {
  id?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      <h2 id={id} className="font-heading text-[2rem] leading-[1.02] font-bold tracking-tight text-balance sm:text-5xl">{title}</h2>
      {lead && <p className={cn("text-lg leading-relaxed", onDark ? "text-papel/80" : "text-muted-foreground")}>{lead}</p>}
    </div>
  );
}

/** A check-list item with the lime tick. */
export function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-lima text-tinta">
        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}
