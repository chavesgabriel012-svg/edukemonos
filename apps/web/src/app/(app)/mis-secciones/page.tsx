import type { Metadata } from "next";
import { Award } from "lucide-react";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { LeaderboardCard, SectionGoalCard } from "@/components/learn/section-goal-card";
import { TournamentCard } from "@/components/learn/tournament-card";
import { action } from "@/components/ui/action";
import { card } from "@/components/ui/styles";
import { brand } from "@/lib/brand";
import { nicknameOptions, studentSections } from "@/lib/sections";
import { HideToggle } from "./hide-toggle";
import { NicknameForm } from "./nickname-form";

export const metadata: Metadata = { title: "Mis secciones" };

export default async function MySectionsPage() {
  const { sections, groups, nickname, hidden, signedIn } = await studentSections();
  const options = signedIn && sections.length && !nickname ? await nicknameOptions() : [];

  if (!sections.length) {
    return (
      <section className="mx-auto max-w-xl space-y-5">
        <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Mis secciones</h1>
        <div className={`${card} space-y-4`}>
          <Kemo size={64} background={brand.lima} />
          <p>Todavía no estás en ninguna sección. Si tu docente te dio un código, únete y aquí verás la meta de la semana, la tabla y el torneo de los viernes.</p>
          <Link href="/unirme" className={action({ size: "md" })}>Unirme a mi sección</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">{groups.length ? `Tu grupo: ${groups.map((g) => g.name).join(", ")}` : "Mis secciones"}</h1>
        {groups.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Abajo están tus materias. Cada docente ve tu avance en la suya
            {" "}y, si tu grupo tiene docente guía, ve el de todas.{" "}
            <Link href={`/estudiar/${groups[0].gradeId}`} className="font-medium underline underline-offset-2">Ir a estudiar</Link>
          </p>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <h2 className="font-heading text-2xl font-bold">{nickname ? `Tu apodo: ${nickname}` : "Elige tu apodo"}</h2>
        <p className="text-sm text-muted-foreground">
          Tu apodo es lo único que ven tus compañeros en la tabla de la semana. Tu nombre nunca aparece ahí.
        </p>
        {nickname ? <HideToggle hidden={hidden} /> : <NicknameForm options={options} />}
      </div>

      {sections.map((s) => (
        <article key={s.id} className={`${card} space-y-6`}>
          <h2 className="font-heading text-2xl font-bold">{s.name}</h2>
          <SectionGoalCard goal={s.goal} />
          <LeaderboardCard board={s.leaderboard} hasNickname={Boolean(nickname)} />
          <TournamentCard sectionId={s.id} data={s.tournament} />
          {!s.goal?.enabled && !s.leaderboard?.enabled && !s.tournament?.enabled && <p className="text-sm text-muted-foreground">Tu docente no usa la meta, la tabla ni el torneo en esta sección.</p>}
        </article>
      ))}

      <Link href="/insignias" className={`${card} flex items-center gap-4 transition hover:border-violeta`}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lima text-tinta"><Award aria-hidden strokeWidth={2.5} className="size-5" /></span>
        <span>
          <span className="block font-heading text-xl font-bold">Mis insignias</span>
          <span className="block text-sm text-muted-foreground">Lo que ya dominas y tus certificados de tema.</span>
        </span>
      </Link>
    </section>
  );
}
