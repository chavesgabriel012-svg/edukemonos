"use client";

import { useActionState } from "react";
import { saveInstitution, type InstitutionState } from "@/app/(app)/admin/actions";
import { action } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

export const STATUS_LABEL = { preparando: "Preparando", activo: "Activo", pausado: "Pausado" } as const;

/** Creates a school (no `school`) or edits one. Saving goes to the school's page. */
export function InstitutionForm({ school }: { school?: { id: string; name: string; slug: string | null; status: keyof typeof STATUS_LABEL; budget: number | null } }) {
  const [state, formAction, pending] = useActionState<InstitutionState, FormData>(saveInstitution, {});
  return (
    <form action={formAction} className="space-y-4">
      {school && <input type="hidden" name="id" value={school.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium">Nombre del colegio</span>
          <input name="name" required maxLength={160} defaultValue={school?.name} className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Nombre corto (opcional)</span>
          <input name="slug" maxLength={40} defaultValue={school?.slug ?? ""} placeholder="liceo-ejemplo" className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Estado</span>
          <select name="status" defaultValue={school?.status ?? "preparando"} className={field}>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Presupuesto de IA del mes (USD, vacío = sin tope)</span>
          <input name="budget" inputMode="decimal" defaultValue={school?.budget ?? ""} className={field} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">El gasto se marca en amarillo desde el 80 % del presupuesto y en rojo desde el 100 %. Kemo nunca se corta.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={action({ size: "md" })}>{pending ? "Guardando…" : school ? "Guardar colegio" : "Crear colegio"}</button>
        {state.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
