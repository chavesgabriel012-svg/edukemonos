import type { StudentTournament } from "@edukemonos/curriculum";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { action } from "@/components/ui/action";

const fmtPoints = (n: number) => String(n).replace(".", ",");

/**
 * The section's Friday tournament for a student: when it opens, their team and points, and the
 * teams above the last one. No names, no positions; points come from right answers and mastery,
 * never from speed.
 */
export function TournamentCard({ sectionId, data }: { sectionId: string; data: StudentTournament | null }) {
  if (!data?.enabled) return null;
  const t = data.tournament ?? null;
  const me = t?.me ?? null;
  const open = data.status === "open" && t;
  const left = me ? me.questions - me.answered : 0;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Trophy aria-hidden strokeWidth={2.5} className="size-4" />
        TORNEO DE LOS VIERNES
      </p>

      {data.status === "upcoming" && (
        <p className="text-sm">
          El torneo de la semana abre el viernes y cierra el domingo en la noche. Los temas son los que la sección practicó
          esta semana: cada habilidad que domines suma a tu equipo.
        </p>
      )}
      {data.status === "none" && (
        <p className="text-sm text-muted-foreground">
          Esta semana no hay torneo. Se arma cuando al menos 6 estudiantes de la sección practican durante la semana.
        </p>
      )}

      {t && (
        <div className="space-y-3">
          {open ? (
            <p className="font-heading text-xl leading-tight font-bold">
              {me ? `Estás en el ${me.team}` : "El torneo está abierto"}
            </p>
          ) : (
            <p className="text-sm font-medium">Resultado del último torneo</p>
          )}

          {me && (
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[14px] bg-secondary p-2.5">
                <dd className="font-heading text-2xl leading-none font-bold">{fmtPoints(me.team_score)}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">puntaje del equipo</dt>
              </div>
              <div className="rounded-[14px] bg-secondary p-2.5">
                <dd className="font-heading text-2xl leading-none font-bold">{me.counted}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">tus aciertos</dt>
              </div>
              <div className="rounded-[14px] bg-secondary p-2.5">
                <dd className="font-heading text-2xl leading-none font-bold">+{me.improvement_points}</dd>
                <dt className="mt-1 text-xs text-muted-foreground">por dominio</dt>
              </div>
            </dl>
          )}

          {t.teams.length > 0 && (
            <ol className="divide-y rounded-[16px] border">
              {t.teams.map((team) => (
                <li key={team.name} className={`flex min-h-11 items-center justify-between gap-3 px-3 py-2 ${team.me ? "bg-secondary font-semibold" : ""}`}>
                  <span>{team.me ? `Tu equipo · ${team.name}` : team.name}</span>
                  <span className="font-mono text-sm">{fmtPoints(team.score)}</span>
                </li>
              ))}
            </ol>
          )}

          {t.topics.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Temas del torneo</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {t.topics.map((topic) => <li key={topic}>{topic}</li>)}
              </ul>
            </details>
          )}

          {open && (
            <div className="flex flex-wrap items-center gap-3">
              {(!me?.started || left > 0) && (
                <Link href={`/mis-secciones/${sectionId}/torneo`} className={action({ size: "md" })}>
                  {me?.started ? `Seguir (${left} ${left === 1 ? "pregunta" : "preguntas"})` : "Jugar el torneo"}
                </Link>
              )}
              <span className="text-xs text-muted-foreground">Cierra el domingo a la medianoche.</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Puntos: 1 por cada acierto (hasta 10) y 1 por cada 5 puntos que sube tu dominio en los temas esta semana. El
            equipo suma el promedio de sus integrantes. No hay reloj.
          </p>
        </div>
      )}
    </div>
  );
}
