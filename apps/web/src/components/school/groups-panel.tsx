"use client";

import { useActionState } from "react";
import { createGroups, type GroupsState } from "@/app/(app)/docente/institucion/actions";
import { setGroupGuide, type SettingsState } from "@/app/(app)/docente/actions";
import { action } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

export interface SchoolGroup {
  id: string;
  name: string;
  grade_id: number;
  guide_name: string | null;
}

export function GroupsPanel({ institutionId, groups }: { institutionId: string; groups: SchoolGroup[] }) {
  const [state, formAction, pending] = useActionState<GroupsState, FormData>(createGroups.bind(null, institutionId), {});
  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_3fr_auto] sm:items-end">
          <label className="space-y-1">
            <span className="text-sm font-medium">Año</span>
            <select name="grade" defaultValue="7" className={field}>
              {[7, 8, 9].map((g) => <option key={g} value={g}>{g}.º</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Nombres de los grupos</span>
            <input name="names" placeholder="7-1, 7-2, 7-3" className={field} />
          </label>
          <button disabled={pending} className={action({ size: "md" })}>{pending ? "Creando…" : "Crear grupos"}</button>
        </div>
        {state.created ? <p role="status" className="text-sm">{state.created === 1 ? "Se creó 1 grupo." : `Se crearon ${state.created} grupos.`}</p> : null}
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      </form>

      {groups.length > 0 && (
        <ul className="divide-y rounded-[16px] border">
          {groups.map((g) => <GroupRow key={g.id} group={g} />)}
        </ul>
      )}
    </div>
  );
}

function GroupRow({ group }: { group: SchoolGroup }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(setGroupGuide.bind(null, group.id), {});
  return (
    <li className="space-y-2 p-3 text-sm">
      <p><span className="font-medium">{group.name}</span> <span className="tabular-nums text-xs text-muted-foreground">{group.grade_id}.º año · {group.guide_name ? `guía: ${group.guide_name}` : "sin persona guía"}</span></p>
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <label className="min-w-56 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Correo de la persona guía (vacío la quita)</span>
          <input type="email" name="email" className={field} />
        </label>
        <button disabled={pending} className={action({ variant: "soft", size: "md" })}>{pending ? "Guardando…" : "Asignar guía"}</button>
      </form>
      {state.saved && <p role="status" className="text-xs">Listo.</p>}
      {state.error && <p role="alert" className="text-xs text-destructive">{state.error}</p>}
    </li>
  );
}
