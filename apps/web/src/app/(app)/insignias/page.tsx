import { BADGE_INFO, type BadgeKind, type EarnedBadge, nextStreakBadge, STREAK_MILESTONES } from "@edukemonos/curriculum";
import { Award, Flame, GraduationCap, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { action } from "@/components/ui/action";
import { card, eyebrow } from "@/components/ui/styles";
import { longDate, myBadges } from "@/lib/badges";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Mis insignias" };

const STREAK: { badge: BadgeKind; weeks: number }[] = [{ badge: "first_week", weeks: 1 }, ...STREAK_MILESTONES.map((w) => ({ badge: `streak_${w}` as BadgeKind, weeks: w }))];

/** What the student has earned: only for mastery, and nothing is ever taken away. */
export default async function BadgesPage() {
  const data = await myBadges();
  if (!data) {
    return (
      <section className="mx-auto max-w-xl space-y-5">
        <h1 className="font-heading text-4xl font-bold">Mis insignias</h1>
        <div className={`${card} space-y-4`}>
          <Kemo size={64} mood="normal" background={brand.lima} />
          <p>Las insignias se ganan dominando habilidades y temas, y cumpliendo semanas de práctica. Empieza a practicar y aparecerán aquí.</p>
          <Link href="/estudiar" className={action({ size: "md" })}>Elegir mi año</Link>
        </div>
      </section>
    );
  }

  const earned = new Set(data.badges.map((b) => b.badge));
  const units = data.badges.filter((b) => b.badge === "unit_mastered");
  const skills = data.badges.filter((b) => b.badge === "skill_mastered");
  const bySubject = new Map<string, EarnedBadge[]>();
  for (const s of skills) bySubject.set(s.subject ?? "Otras", [...(bySubject.get(s.subject ?? "Otras") ?? []), s]);
  const next = nextStreakBadge(data.record);

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Mis insignias</h1>
        <p className="text-muted-foreground">Se ganan solo por lo que dominas. Aunque tu dominio baje después, las insignias se quedan.</p>
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold"><Flame aria-hidden strokeWidth={2.5} className="size-6 text-violeta" />Racha</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STREAK.map(({ badge, weeks }) => {
            const has = earned.has(badge);
            return (
              <li key={badge} className={`space-y-2 rounded-[18px] p-4 text-center ${has ? "bg-lima text-tinta" : "border-2 border-dashed text-muted-foreground"}`}>
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white/60">
                  {has ? <span className="font-heading text-2xl font-bold">{weeks}</span> : <Lock aria-hidden strokeWidth={2.5} className="size-5" />}
                </span>
                <p className="text-sm leading-tight font-semibold">{BADGE_INFO[badge].title}</p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">
          Tu mejor racha: {data.record} {data.record === 1 ? "semana" : "semanas"}.
          {next ? ` La siguiente insignia llega con ${next.weeks} ${next.weeks === 1 ? "semana cumplida" : "semanas seguidas"}.` : " ¡Ya tienes todas las de racha!"}
        </p>
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold"><GraduationCap aria-hidden strokeWidth={2.5} className="size-6 text-violeta" />Temas dominados</h2>
        {units.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cuando todas las habilidades de un tema lleguen a 70 %, el tema queda dominado y puedes descargar su certificado.</p>
        ) : (
          <ul className="space-y-2">
            {units.map((u) => (
              <li key={u.ref_id} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4">
                <span className="min-w-0">
                  <span className="block font-semibold">{u.title}</span>
                  <span className={eyebrow}>{u.subject} · {u.grade}.º · {longDate(u.earned_at)}</span>
                </span>
                <Link href={`/certificado/${u.ref_id}`} className={action({ variant: "soft", size: "sm" })}>Ver certificado</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${card} space-y-4`}>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold"><Award aria-hidden strokeWidth={2.5} className="size-6 text-violeta" />Habilidades dominadas · {skills.length}</h2>
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">Una habilidad queda dominada cuando tu dominio estimado llega a 70 %. Practica y aquí aparecerán.</p>
        ) : (
          [...bySubject.entries()].map(([subject, list]) => (
            <div key={subject} className="space-y-2">
              <p className={eyebrow}>{subject}</p>
              <ul className="space-y-1.5 text-sm">
                {list.map((s) => (
                  <li key={s.ref_id} className="flex gap-2.5">
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-violeta" />
                    <span>{s.title} <span className="text-muted-foreground">· {s.unit}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
