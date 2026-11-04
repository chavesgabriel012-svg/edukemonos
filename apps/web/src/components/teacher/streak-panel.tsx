import Link from "next/link";
import type { SectionGamification } from "@/lib/gamification";
import { CalendarSummary } from "./calendar-summary";
import { StatTiles } from "./charts";
import { SectionSettingsForm } from "./section-settings-form";

const weeks = (n: number) => `${n} ${n === 1 ? "semana" : "semanas"}`;

/**
 * Weekly streak in the teacher panel: aggregates only (no ranking, no names), the section's
 * settings (everything works without touching them) and the calendar it follows.
 */
export function StreakPanel({ sectionId, data, demo }: { sectionId: string; data: SectionGamification; demo: boolean }) {
  const s = data.summary;
  const adminOf = data.institutions.find((i) => i.id === data.institutionId && i.admin);
  return (
    <section aria-labelledby="racha-t" className="min-w-0 space-y-5 rounded-[22px] border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="racha-t" className="font-heading text-2xl font-bold">Racha semanal</h2>
        <p className="text-sm text-muted-foreground">
          Cada estudiante suma una semana a su racha cuando resuelve bien {s.target} ejercicios distintos. Premia el dominio, no el
          tiempo en pantalla. En vacaciones la racha se pausa. No necesita hacer nada: funciona sola.
        </p>
      </div>
      {!s.enabled ? (
        <p className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">La racha está apagada para esta sección: sus estudiantes no la ven.</p>
      ) : s.paused ? (
        <p className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">Esta semana es de vacaciones según el calendario: las rachas están en pausa.</p>
      ) : (
        <StatTiles items={[
          { label: "Cumplieron la meta esta semana", value: `${s.met_this_week} de ${s.students}` },
          { label: "Con racha activa", value: String(s.with_streak), hint: "Una semana o más seguidas" },
          { label: "Racha más larga", value: weeks(s.longest), hint: "Sin mostrar de quién es" },
        ]} />
      )}
      <details className="rounded-[16px] border p-4" open={!s.enabled}>
        <summary className="cursor-pointer font-medium">Ajustes de la sección</summary>
        <div className="mt-4 space-y-6">
          <SectionSettingsForm
            sectionId={sectionId}
            streakEnabled={data.settings.streakEnabled}
            weeklyTarget={data.settings.weeklyTarget}
            institutionId={data.institutionId}
            institutions={data.institutions}
            demo={demo}
          />
          <div className="space-y-2">
            <h3 className="font-medium">Calendario</h3>
            <CalendarSummary calendar={data.calendar} />
            {adminOf && (
              <Link href={`/docente/institucion/${adminOf.id}`} className="inline-block text-sm font-medium underline underline-offset-2">
                Editar el calendario de {adminOf.name}
              </Link>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
