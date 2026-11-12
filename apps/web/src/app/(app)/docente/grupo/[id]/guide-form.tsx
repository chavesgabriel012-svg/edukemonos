"use client";

import { useActionState } from "react";
import { setGroupGuide, type SettingsState } from "@/app/(app)/docente/actions";
import { action as actionClass } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

export function GuideForm({ groupId, hasGuide }: { groupId: string; hasGuide: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(setGroupGuide.bind(null, groupId), {});
  return (
    <form action={action} className="space-y-2">
      <label className="block space-y-1">
        <span className="text-sm font-medium">{hasGuide ? "Cambiar la persona guía" : "Asignar persona guía"} (correo con que entra a Eduka)</span>
        <input type="email" name="email" className={field} />
      </label>
      <p className="text-xs text-muted-foreground">La persona guía ve el rendimiento de todos los estudiantes del grupo en todas las materias. Deje el correo vacío para quitarla.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={actionClass({ size: "md" })}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {state.saved && <span role="status" className="text-sm">Listo.</span>}
        {state.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
