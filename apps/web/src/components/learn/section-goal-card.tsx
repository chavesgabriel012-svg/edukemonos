import type { Leaderboard, SectionGoal } from "@/lib/sections";

/** "Between all of us": the section's weekly goal, in skills mastered this week. */
export function SectionGoalCard({ goal }: { goal: SectionGoal | null }) {
  if (!goal?.enabled || goal.target === undefined) return null;
  const progress = goal.progress ?? 0;
  const pct = Math.min(100, Math.round((progress / goal.target) * 100));
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-muted-foreground">META DE LA SECCIÓN</p>
      {goal.paused ? (
        <p className="text-sm">Semana de vacaciones: la meta descansa.</p>
      ) : (
        <>
          <p className="font-heading text-xl leading-tight font-bold">Entre todos: {progress} de {goal.target} habilidades dominadas</p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={goal.target} aria-valuenow={Math.min(progress, goal.target)} aria-label="Avance de la meta">
            <div className="h-full rounded-full bg-violeta" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-muted-foreground">
            {progress >= goal.target ? "¡Lo lograron! La sección llegó a la meta de la semana." : "Cada habilidad que alguien de la sección domina esta semana suma."}
          </p>
        </>
      )}
    </div>
  );
}

/** The week's table: own row and the 2 classmates above and below. No positions, no full list. */
export function LeaderboardCard({ board, hasNickname }: { board: Leaderboard | null; hasNickname: boolean }) {
  if (!board?.enabled) return null;
  const rows = board.rows ?? [];
  let note: string | null = null;
  if (!hasNickname) note = "Elige un apodo arriba para aparecer en la tabla.";
  else if (board.me?.hidden) note = "Ocultaste tu apodo: no apareces en la tabla. Puedes volver cuando quieras.";
  else if ((board.me?.points ?? 0) <= 0) note = "Cuando tu dominio suba esta semana, aparecerás aquí.";
  else if (!board.enough) note = "La tabla aparece cuando al menos 4 compañeros mejoran esta semana.";
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-muted-foreground">MEJORA DE LA SEMANA</p>
      <p className="text-sm text-muted-foreground">Cuenta cuánto subió tu dominio esta semana, no cuánto sabes. Solo ves a quienes están cerca de ti.</p>
      {rows.length > 0 && (
        <ol className="divide-y rounded-[16px] border">
          {rows.map((r) => (
            <li key={r.nickname} className={`flex min-h-11 items-center justify-between gap-3 px-3 py-2 ${r.me ? "bg-secondary font-semibold" : ""}`}>
              <span>{r.me ? `Tú · ${r.nickname}` : r.nickname}</span>
              <span className="font-mono text-sm">+{r.points}</span>
            </li>
          ))}
        </ol>
      )}
      {note && rows.length === 0 && <p className="text-sm">{note}</p>}
    </div>
  );
}
