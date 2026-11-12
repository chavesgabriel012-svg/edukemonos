"use client";

import { useActionState } from "react";
import { createSection } from "@/app/(app)/docente/actions";

/** "Agregar mi materia": a subject section of this group, for the institution's teachers. */
export function AddSubjectForm({ groupId, subjects }: { groupId: string; subjects: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createSection, null);
  if (!subjects.length) return <p className="text-sm text-muted-foreground">Todas las materias ya tienen docente en este grupo.</p>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="group_id" value={groupId} />
      <label className="space-y-1">
        <span className="block text-sm font-medium">Materia que usted enseña</span>
        <select name="subject_id" required defaultValue="" className="h-11 rounded-[12px] border bg-background px-3 text-base">
          <option value="" disabled>Elija una materia</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <button disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Agregando…" : "Agregar mi materia"}
      </button>
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
