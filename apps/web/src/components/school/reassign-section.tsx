"use client";

import { useState } from "react";
import { reassignSection } from "@/app/(app)/docente/institucion/actions";
import { action } from "@/components/ui/action";
import { field } from "@/components/ui/styles";
import type { Member } from "./people-panel";
import { useRun } from "./run";

export interface SchoolSection {
  id: string;
  name: string;
  teacher_id: string;
}

/** Passes each section to another teacher of the school (leave, replacement). */
export function ReassignSection({ sections, members }: { sections: SchoolSection[]; members: Member[] }) {
  if (sections.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay secciones en el colegio.</p>;
  return (
    <ul className="divide-y rounded-[16px] border">
      {sections.map((s) => (
        <Row key={s.id} section={s} members={members} />
      ))}
    </ul>
  );
}

function Row({ section, members }: { section: SchoolSection; members: Member[] }) {
  const { pending, error, run } = useRun();
  const [teacher, setTeacher] = useState(section.teacher_id);
  return (
    <li className="space-y-2 p-3 text-sm">
      <p className="font-medium">{section.name}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Docente</span>
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className={field}>
            {members.map((m) => (
              <option key={m.profile_id} value={m.profile_id}>{m.name}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={pending || teacher === section.teacher_id} onClick={() => run(() => reassignSection(section.id, teacher))} className={action({ size: "md" })}>
          {pending ? "Guardando…" : "Reasignar"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </li>
  );
}
