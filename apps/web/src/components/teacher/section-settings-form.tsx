"use client";

import { useActionState } from "react";
import { saveSectionSettings, type SettingsState } from "@/app/(app)/docente/actions";
import { action as actionClass } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

export function SectionSettingsForm({ sectionId, streakEnabled, weeklyTarget, goalEnabled, leaderboardEnabled, gamesEnabled, tournamentEnabled, institutionId, institutions, demo }: {
  sectionId: string;
  streakEnabled: boolean;
  weeklyTarget: number;
  goalEnabled: boolean;
  leaderboardEnabled: boolean;
  gamesEnabled: boolean;
  tournamentEnabled: boolean;
  institutionId: string | null;
  institutions: { id: string; name: string }[];
  demo: boolean;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSectionSettings.bind(null, sectionId), {});
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={demo || pending} className="space-y-4">
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="streak_enabled" defaultChecked={streakEnabled} className="size-5" />
          <span>Mostrar la racha semanal a los estudiantes</span>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="goal_enabled" defaultChecked={goalEnabled} className="size-5" />
          <span>Mostrar la meta semanal de la sección</span>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="leaderboard_enabled" defaultChecked={leaderboardEnabled} className="size-5" />
          <span>Mostrar la tabla de mejora con apodos</span>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="games_enabled" defaultChecked={gamesEnabled} className="size-5" />
          <span>Ofrecer los minijuegos (cada respuesta cuenta para el dominio)</span>
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="tournament_enabled" defaultChecked={tournamentEnabled} className="size-5" />
          <span>Armar el torneo de los viernes</span>
        </label>
        <label className="block space-y-1">
          <span className="block font-medium">Ejercicios bien resueltos por semana para cumplir la racha</span>
          <input type="number" name="weekly_target" min={1} max={50} defaultValue={weeklyTarget} className={`${field} w-28`} />
          <span className="block text-xs text-muted-foreground">Por defecto, 5. Cuentan ejercicios distintos, en cualquier actividad.</span>
        </label>
        {institutions.length > 0 && (
          <label className="block space-y-1">
            <span className="font-medium">Institución</span>
            <select name="institution_id" defaultValue={institutionId ?? ""} className={`${field} max-w-sm`}>
              <option value="">Ninguna (calendario oficial del MEP)</option>
              {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <span className="block text-xs text-muted-foreground">La sección usa el calendario de su institución.</span>
          </label>
        )}
      </fieldset>
      {demo ? (
        <p className="text-sm text-muted-foreground">En la demostración los ajustes no se pueden cambiar.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className={actionClass({ size: "md" })}>
            {pending ? "Guardando…" : "Guardar ajustes"}
          </button>
          {state.saved && <span role="status" className="text-sm">Ajustes guardados.</span>}
          {state.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
        </div>
      )}
    </form>
  );
}
