import type { SectionGamification } from "@/lib/gamification";

/**
 * The section's weekly goal and how many take part in the nickname table. The teacher sees the
 * goal and participation; never who is where in the table.
 */
export function GoalPanel({ data }: { data: SectionGamification }) {
  const g = data.goal;
  const lb = data.leaderboard;
  return (
    <section aria-labelledby="meta-t" className="min-w-0 space-y-5 rounded-[22px] border bg-card p-5 sm:p-6">
      <div className="space-y-1">
        <h2 id="meta-t" className="font-heading text-2xl font-bold">Meta de la sección</h2>
        <p className="text-sm text-muted-foreground">
          Cada semana, Eduka propone una meta para toda la sección: cuántas habilidades dominan entre todos. Se calcula sola según el
          tamaño y el nivel de la sección.
        </p>
      </div>
      {!g?.enabled ? (
        <p className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">La meta está apagada para esta sección.</p>
      ) : g.paused ? (
        <p className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">Semana de vacaciones según el calendario: la meta descansa.</p>
      ) : (
        <div className="space-y-2">
          <p className="font-heading text-3xl leading-none font-bold">{g.progress} de {g.target}</p>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={g.target} aria-valuenow={Math.min(g.progress ?? 0, g.target ?? 0)} aria-label="Avance de la meta">
            <div className="h-full rounded-full bg-violeta" style={{ width: `${Math.min(100, Math.round(((g.progress ?? 0) / (g.target ?? 1)) * 100))}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">habilidades dominadas esta semana entre todos los estudiantes de la sección.</p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Cómo se calculó</summary>
            <p className="mt-2 text-muted-foreground">
              {g.history?.some((h) => h > 0)
                ? `En las últimas semanas de clases la sección dominó ${g.history.join(", ")} habilidades por semana. La meta es un 10 % más que la mediana, y nunca menos de 3.`
                : `Todavía no hay semanas anteriores con avance: la meta es media habilidad por cada estudiante activo (${g.active_students} en las últimas 4 semanas), y nunca menos de 3.`}
              {" "}Una habilidad cuenta cuando el dominio estimado de un estudiante pasa de menos de 70 % a 70 % o más durante la semana.
            </p>
          </details>
        </div>
      )}
      {data.settings.leaderboardEnabled && lb && (
        <div className="space-y-1 rounded-[16px] border p-4 text-sm">
          <p className="font-medium">Tabla de mejora con apodos</p>
          <p className="text-muted-foreground">
            {lb.with_nickname} de {lb.members} estudiantes eligieron apodo{lb.hidden ? ` y ${lb.hidden} prefirieron no aparecer` : ""}. Cada estudiante ve solo su fila y
            a 2 compañeros arriba y abajo, por cuánto mejoró esta semana. Nadie ve el último lugar ni la lista completa, y usted
            tampoco ve el orden.
          </p>
        </div>
      )}
    </section>
  );
}
