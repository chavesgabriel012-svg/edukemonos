"use client";

import { useActionState, useState } from "react";
import { createSection } from "./actions";

const field = "h-11 w-full rounded-[12px] border bg-background px-3";

/**
 * A section is either the teacher's subject in a group (students join with the group's code) or a
 * standalone section with its own code and every subject (as before groups existed).
 */
export function NewSectionForm({ groups, subjects }: { groups: { id: string; name: string }[]; subjects: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createSection, null);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {groups.length > 0 && (
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">Grupo</span>
          <select name="group_id" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={field}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            <option value="">Sección suelta, con su propio código y todas las materias</option>
          </select>
        </label>
      )}
      {groupId ? (
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">Materia que usted enseña en el grupo</span>
          <select name="subject_id" required defaultValue="" className={field}>
            <option value="" disabled>Elija una materia</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="block text-xs text-muted-foreground">Usted verá solo el avance de esta materia. Sus estudiantes se unen con el código del grupo.</span>
        </label>
      ) : (
        <>
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
        </>
      )}
      <label className="space-y-1">
        <span className="text-sm font-medium">Trimestre actual</span>
        <select name="term" defaultValue="" className={field}>
          <option value="">Sin indicar</option>
          <option value="1">I trimestre</option>
          <option value="2">II trimestre</option>
          <option value="3">III trimestre</option>
        </select>
      </label>
      {!groupId && (
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">Institución <span className="font-normal text-muted-foreground">(opcional)</span></span>
          <input name="institution" maxLength={160} className={field} />
        </label>
      )}
      {state?.error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className="h-[52px] rounded-[14px] bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? "Creando…" : "Crear sección"}
        </button>
      </div>
    </form>
  );
}
