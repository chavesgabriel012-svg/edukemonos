"use client";

import { useActionState } from "react";
import { createGroup } from "./actions";

const field = "h-11 w-full rounded-[12px] border bg-background px-3 text-base";

/** A group (e.g. 7-3) with one code for all its subjects. With an institution, only its admins. */
export function NewGroupForm({ institutions }: { institutions: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createGroup, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1">
        <span className="text-sm font-medium">Nombre del grupo</span>
        <input name="name" required maxLength={40} placeholder="Ej.: 7-3" className={field} />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">Año</span>
        <select name="grade" required defaultValue="7" className={field}>
          <option value="7">7.º</option>
          <option value="8">8.º</option>
          <option value="9">9.º</option>
        </select>
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm font-medium">Institución</span>
        <select name="institution_id" defaultValue={institutions[0]?.id ?? ""} className={field}>
          {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          <option value="">Sin institución (solo yo agrego materias)</option>
        </select>
      </label>
      {state?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className="h-[52px] rounded-[14px] bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? "Creando…" : "Crear grupo"}
        </button>
      </div>
    </form>
  );
}
