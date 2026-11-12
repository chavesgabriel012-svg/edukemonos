"use client";

import { useActionState } from "react";
import { addInstitutionMember, type SettingsState } from "@/app/(app)/docente/actions";
import { action as actionClass } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

export function MemberForm({ institutionId }: { institutionId: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addInstitutionMember.bind(null, institutionId), {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <label className="space-y-1">
          <span className="text-sm font-medium">Correo con que entra a Eduka</span>
          <input type="email" name="email" required className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Papel</span>
          <select name="role" defaultValue="teacher" className={field}>
            <option value="teacher">Docente</option>
            <option value="admin">Administración</option>
          </select>
        </label>
        <button disabled={pending} className={actionClass({ size: "md" })}>
          {pending ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {state.saved && <p role="status" className="text-sm">Listo: ya forma parte de la institución.</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
