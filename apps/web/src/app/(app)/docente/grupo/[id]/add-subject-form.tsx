"use client";

import { useActionState } from "react";
import { createSection } from "@/app/(app)/docente/actions";
import { action as actionClass } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

/** "Agregar mi materia": a subject section of this group, for the institution's teachers. */
export function AddSubjectForm({ groupId, subjects }: { groupId: string; subjects: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createSection, null);
  if (!subjects.length) return <p className="text-sm text-muted-foreground">Todas las materias ya tienen docente en este grupo.</p>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="group_id" value={groupId} />
      <label className="space-y-1">
        <span className="block text-sm font-medium">Materia que usted enseña</span>
        <select name="subject_id" required defaultValue="" className={field}>
          <option value="" disabled>Elija una materia</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <button disabled={pending} className={actionClass({ size: "md" })}>
        {pending ? "Agregando…" : "Agregar mi materia"}
      </button>
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
