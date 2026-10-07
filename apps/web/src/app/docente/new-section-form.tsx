"use client";

import { useActionState } from "react";
import { createSection } from "./actions";

const field = "h-11 w-full rounded-[12px] border bg-background px-3";

export function NewSectionForm() {
  const [state, action, pending] = useActionState(createSection, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm font-medium">Nombre de la sección</span>
        <input name="name" required maxLength={80} placeholder="Ej.: 7-3" className={field} />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">Año</span>
        <select name="grade" required defaultValue="7" className={field}>
          <option value="7">7.º</option>
          <option value="8">8.º</option>
          <option value="9">9.º</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">Trimestre actual</span>
        <select name="term" defaultValue="" className={field}>
          <option value="">Sin indicar</option>
          <option value="1">I trimestre</option>
          <option value="2">II trimestre</option>
          <option value="3">III trimestre</option>
        </select>
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm font-medium">Institución <span className="font-normal text-muted-foreground">(opcional)</span></span>
        <input name="institution" maxLength={160} className={field} />
      </label>
      {state?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className="h-[52px] rounded-[14px] bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? "Creando…" : "Crear sección"}
        </button>
      </div>
    </form>
  );
}
