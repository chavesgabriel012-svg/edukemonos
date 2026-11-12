import { EyeOff, LifeBuoy, type LucideIcon, ShieldCheck, UserRoundX } from "lucide-react";
import Link from "next/link";
import { Kemo, type KemoMood } from "@/components/brand/logo";
import { SHELL } from "@/components/site/page-shell";
import { action } from "@/components/ui/action";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";
import { RETENTION_DAYS_CHAT } from "@/lib/tutor-server";

/** Blocks shared by the landing and the pages for each audience (familias, docentes, colegios). */

const SAFETY = [
  { icon: UserRoundX, title: "Sin cuenta", text: "Se estudia sin correo ni contraseña." },
  { icon: EyeOff, title: "Sin nombres", text: "El nombre y los datos personales no llegan a la IA." },
  { icon: ShieldCheck, title: "Chats privados", text: `El docente no puede leerlos. Se borran a los ${RETENTION_DAYS_CHAT} días.` },
  { icon: LifeBuoy, title: "Ante el malestar", text: "Kemo anima a hablar con una persona adulta de confianza y la app muestra el 911." },
] as const;

/** The four safeguards for minors, on a Tinta band. */
export function SafetyGrid() {
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SAFETY.map(({ icon: Icon, title, text }) => (
        <li key={title} className="space-y-2 rounded-[22px] bg-white/8 p-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-lima text-tinta">
            <Icon aria-hidden strokeWidth={2.5} className="size-5" />
          </span>
          <h3 className="font-heading text-xl leading-tight font-bold">{title}</h3>
          <p className="text-sm leading-relaxed text-papel/75">{text}</p>
        </li>
      ))}
    </ul>
  );
}

/** A card with an icon, a title and one or two sentences. */
export function Feature({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <li className="space-y-3 rounded-[22px] border bg-card p-5">
      <span className="flex size-11 items-center justify-center rounded-xl bg-violeta text-white">
        <Icon aria-hidden strokeWidth={2.5} className="size-5" />
      </span>
      <h3 className="font-heading text-xl leading-tight font-bold">{title}</h3>
      <p className="leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}

/** Numbered steps, one card each. */
export function Steps({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((s, i) => (
        <li key={s.title} className="space-y-3 rounded-[22px] bg-background p-5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-lima font-heading text-xl font-bold text-tinta">{i + 1}</span>
          <h3 className="font-heading text-xl leading-tight font-bold">{s.title}</h3>
          <p className="leading-relaxed text-muted-foreground">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** Questions that open in place. */
export function Questions({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="mt-8 max-w-3xl space-y-3">
      {items.map((f) => (
        <details key={f.q} className="group rounded-[16px] border bg-card px-5 open:pb-5">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-lg font-medium [&::-webkit-details-marker]:hidden">
            {f.q}
            <span aria-hidden className="text-2xl leading-none text-violeta transition group-open:rotate-45">+</span>
          </summary>
          <div className="leading-relaxed text-muted-foreground">{f.a}</div>
        </details>
      ))}
    </div>
  );
}

/** The violet band that opens each audience page. */
export function AudienceHero({ title, lead, mood = "normal", children }: { title: string; lead: string; mood?: KemoMood; children?: React.ReactNode }) {
  return (
    <section className="bg-violeta text-white">
      <div className={`${SHELL} flex items-center justify-between gap-10 py-12 sm:py-16`}>
        <div className="max-w-2xl space-y-5">
          <h1 className="font-heading text-[2.75rem] leading-[0.95] font-bold tracking-tight text-balance sm:text-6xl">{title}</h1>
          <p className="text-xl leading-relaxed text-white/85">{lead}</p>
          {children && <div className="flex flex-wrap gap-3 pt-1">{children}</div>}
        </div>
        <Kemo size={176} mood={mood} background={brand.lima} className="hidden rotate-[6deg] lg:block" />
      </div>
    </section>
  );
}

/** The closing band: one way to try it, and the contact address when there is one. */
export function ClosingBand({ title, text, href, label }: { title: string; text: string; href: string; label: string }) {
  return (
    <section className="bg-violeta text-white">
      <div className={`${SHELL} flex flex-col items-start gap-6 py-14 sm:flex-row sm:items-center sm:justify-between sm:py-16`}>
        <div className="flex items-center gap-5">
          <Kemo size={80} mood="happy" background={brand.lima} className="hidden sm:block" />
          <div className="space-y-2">
            <h2 className="font-heading text-4xl leading-none font-bold sm:text-5xl">{title}</h2>
            <p className="max-w-md text-white/85">{text}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={href} className={action({ variant: "lima-on-dark" })}>{label}</Link>
          {site.contactEmail && <a href={`mailto:${site.contactEmail}`} className={action({ variant: "outline-on-dark" })}>Escribirnos</a>}
        </div>
      </div>
    </section>
  );
}
