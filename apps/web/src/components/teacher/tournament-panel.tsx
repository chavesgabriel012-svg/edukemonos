import type { TournamentReport } from "@edukemonos/curriculum";
import { Trophy } from "lucide-react";

const fmt = (n: number) => String(n).replace(".", ",");

/**
 * The section's Friday tournament for the teacher: every team with its score and, for each
 * student, what they added to their own mastery in the topics. Nothing to prepare or run in class.
 */
export function TournamentPanel({ data, demo }: { data: TournamentReport | null; demo: boolean }) {
  // null: the report could not be read (for example, before the migration is applied). Show nothing.
  if (!data) return null;
  const t = data.tournament ?? null;
  return (
    <section aria-labelledby="torneo-t" className="min-w-0 space-y-5 rounded-[22px] border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="torneo-t" className="flex items-center gap-2 font-heading text-2xl font-bold">
          <Trophy aria-hidden strokeWidth={2.5} className="size-6 text-violeta" />
          Torneo de los viernes
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada viernes Eduka arma equipos mezclados de 3 a 5 estudiantes, sobre los temas que la sección practicó en la semana. Cierra el
          domingo en la noche. Usted no tiene que preparar nada ni usarlo en clase.
        </p>
      </div>

      {!data.enabled ? (
        <p className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">El torneo está apagado para esta sección.</p>
      ) : !t ? (
        <p className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">
          {data.status === "upcoming"
            ? "El primer torneo de la sección se arma el viernes."
            : "Esta semana no hubo torneo: se necesitan al menos 6 estudiantes que hayan practicado en las últimas 4 semanas, y ejercicios verificados de los temas."}
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">
            {data.status === "open" ? "Abierto ahora." : "Resultado del último torneo."}{" "}
            {t.closed && (t.winners?.length ?? 0) > 0 && <strong>Ganó {t.winners!.join(" y ")}. </strong>}
            <span className="text-muted-foreground">Temas: {t.topics.join(" · ")}</span>
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {t.teams.map((team) => (
              <li key={team.name} className={`space-y-2 rounded-[16px] border p-4 ${t.closed && t.winners?.includes(team.name) ? "border-2 border-lima bg-lima/15" : ""}`}>
                <p className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {t.closed && t.winners?.includes(team.name) && <Trophy aria-label="Ganador" strokeWidth={2.5} className="size-4 text-violeta" />}
                    {team.name}
                  </span>
                  <span className="font-mono text-sm">{fmt(team.score)}</span>
                </p>
                <ul className="space-y-1 text-sm">
                  {team.members.map((m) => (
                    <li key={m.student_id} className="flex justify-between gap-3">
                      <span className={m.played ? "" : "text-muted-foreground"}>{m.name}{m.late ? " (se sumó tarde)" : ""}</span>
                      <span className="shrink-0 font-mono text-xs" title="Lo que subió su dominio en los temas esta semana">
                        {m.improvement > 0 ? `+${m.improvement}` : m.played ? "0" : "sin jugar"}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Cómo se calculó</summary>
            <div className="mt-2 space-y-2 text-muted-foreground">
              <p>
                Temas: las habilidades de la sección que más estudiantes practicaron en la semana (hasta 8). Equipos: quienes practicaron en las
                últimas 4 semanas, ordenados por su dominio en esos temas y repartidos de ida y vuelta para que cada equipo tenga un nivel parecido.
                Quien llega después se suma al equipo con menos integrantes.
              </p>
              <p>
                Puntos de cada estudiante: 1 por acierto en sus preguntas del torneo (cuentan hasta 10) y 1 por cada 5 puntos que sube su dominio en
                los temas durante la semana. El equipo suma el promedio de sus integrantes. Nada depende de la velocidad.
              </p>
              <p>
                Junto a cada nombre está lo que subió su dominio en los temas esta semana, en puntos. Cada estudiante ve solo su equipo y los equipos
                por encima del último, nunca nombres.
              </p>
            </div>
          </details>
        </div>
      )}
      {demo && <p className="text-xs text-muted-foreground">Datos de demostración: estudiantes y respuestas ficticias.</p>}
    </section>
  );
}
