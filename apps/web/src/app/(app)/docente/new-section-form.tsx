"use client";

import { useActionState, useState } from "react";
import { createSection } from "./actions";
import { action as actionClass } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

/**
 * A section is the teacher's subject inside a group of their school (students join with the group's
 * code). Only the subjects the school approved for the group's grade can be chosen.
 */
export function NewSectionForm({
  groups,
  subjects,
}: {
  groups: { id: string; name: string; subjectIds: string[] }[];
  subjects: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createSection, null);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const allowed = new Set(groups.find((g) => g.id === groupId)?.subjectIds ?? []);
  const options = subjects.filter((s) => allowed.has(s.id));
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay grupos en su colegio. La coordinación los crea.</p>;
  }
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm font-medium">Grupo</span>
        <select name="group_id" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={field}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm font-medium">Materia que usted enseña en el grupo</span>
        <select key={groupId} name="subject_id" required defaultValue="" className={field}>
          <option value="" disabled>Elija una materia</option>
          {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="block text-xs text-muted-foreground">Usted verá solo el avance de esta materia. Sus estudiantes se unen con el código del grupo.</span>
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
      {state?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className={actionClass()}>
          {pending ? "Creando…" : "Crear sección"}
        </button>
      </div>
    </form>
  );
}
