import type { Metadata } from "next";
import Link from "next/link";
import { LeaderboardCard, SectionGoalCard } from "@/components/learn/section-goal-card";
import { nicknameOptions, studentSections } from "@/lib/sections";
import { HideToggle } from "./hide-toggle";
import { NicknameForm } from "./nickname-form";

export const metadata: Metadata = { title: "Mis secciones" };

export default async function MySectionsPage() {
  const { sections, groups, nickname, hidden, signedIn } = await studentSections();
  const options = signedIn && sections.length && !nickname ? await nicknameOptions() : [];

  if (!sections.length) {
    return (
      <section className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-bold">Mis secciones</h1>
        <p className="text-muted-foreground">Todavía no estás en ninguna sección. Si tu docente te dio un código, únete y aquí verás la meta de la semana de tu sección.</p>
        <Link href="/unirme" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">Unirme a mi sección</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{groups.length ? `Tu grupo: ${groups.map((g) => g.name).join(", ")}` : "Mis secciones"}</h1>
        {groups.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Abajo están tus materias. Cada docente ve tu avance en la suya
            {" "}y, si tu grupo tiene docente guía, ve el de todas.{" "}
            <Link href={`/estudiar/${groups[0].gradeId}`} className="font-medium underline underline-offset-2">Ir a estudiar</Link>
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-[22px] bg-card p-5">
        <h2 className="font-heading text-xl font-bold">{nickname ? `Tu apodo: ${nickname}` : "Elige tu apodo"}</h2>
        <p className="text-sm text-muted-foreground">
          Tu apodo es lo único que ven tus compañeros en la tabla de la semana. Tu nombre nunca aparece ahí.
        </p>
        {nickname ? <HideToggle hidden={hidden} /> : <NicknameForm options={options} />}
      </div>

      {sections.map((s) => (
        <article key={s.id} className="space-y-5 rounded-[22px] bg-card p-5">
          <h2 className="font-heading text-xl font-bold">{s.name}</h2>
          <SectionGoalCard goal={s.goal} />
          <LeaderboardCard board={s.leaderboard} hasNickname={Boolean(nickname)} />
          {!s.goal?.enabled && !s.leaderboard?.enabled && <p className="text-sm text-muted-foreground">Tu docente no usa la meta ni la tabla en esta sección.</p>}
        </article>
      ))}
    </section>
  );
}
