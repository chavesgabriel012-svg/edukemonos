"use client";

import Link from "next/link";
import { approveOffering, markUnitsSeen, setUnitHidden, withdrawOffering } from "@/app/(app)/docente/institucion/actions";
import { action } from "@/components/ui/action";
import { Notice } from "@/components/ui/notice";
import { useRun } from "./run";

export interface ProgramUnit {
  id: string;
  title: string;
  sort_order: number;
  source_page: number | null;
  published_at: string | null;
  hidden: boolean;
  is_new: boolean;
}
export interface ProgramOffering {
  grade_id: number;
  subject_id: string;
  subject_name: string;
  status: "pendiente" | "aprobado" | "retirado";
  approved_at: string | null;
  units: ProgramUnit[];
}

const STATUS = { pendiente: "Pendiente de aprobación", aprobado: "Aprobada", retirado: "Retirada" } as const;

/** «3 temas nuevos en 7.º Matemáticas desde su última revisión» (or «1 tema nuevo…»). */
export function newTopicsNotice(n: number, grade: number, subject: string) {
  return `${n} ${n === 1 ? "tema nuevo" : "temas nuevos"} en ${grade}.º ${subject} desde su última revisión`;
}

export function ProgramApproval({ institutionId, program }: { institutionId: string; program: ProgramOffering[] }) {
  if (program.length === 0) return <p className="text-sm text-muted-foreground">Eduka todavía no ha preparado materias para su colegio.</p>;
  return (
    <ul className="space-y-4">
      {program.map((o) => (
        <Offering key={`${o.grade_id}-${o.subject_id}`} institutionId={institutionId} offering={o} />
      ))}
    </ul>
  );
}

function Offering({ institutionId, offering: o }: { institutionId: string; offering: ProgramOffering }) {
  const { pending, error, run } = useRun();
  const fresh = o.status === "aprobado" ? o.units.filter((u) => u.is_new) : [];
  return (
    <li className="space-y-3 rounded-[16px] border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-bold">{o.grade_id}.º {o.subject_name}</h3>
          <p className="text-sm text-muted-foreground">{STATUS[o.status]} · {o.units.length === 1 ? "1 tema" : `${o.units.length} temas`}</p>
        </div>
        {o.status === "aprobado" ? (
          <button type="button" disabled={pending} onClick={() => run(() => withdrawOffering(institutionId, o.grade_id, o.subject_id))} className={action({ variant: "outline", size: "md" })}>Retirar</button>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(() => approveOffering(institutionId, o.grade_id, o.subject_id))} className={action({ size: "md" })}>
            {o.status === "retirado" ? "Aprobar de nuevo" : "Aprobar"}
          </button>
        )}
      </div>

      {fresh.length > 0 && (
        <Notice tone="warn" className="space-y-2">
          <p className="font-medium">{newTopicsNotice(fresh.length, o.grade_id, o.subject_name)}</p>
          <ul className="space-y-1">
            {fresh.map((u) => <UnitRow key={u.id} institutionId={institutionId} unit={u} />)}
          </ul>
          <button type="button" disabled={pending} onClick={() => run(() => markUnitsSeen(institutionId, o.grade_id, o.subject_id))} className={action({ variant: "soft", size: "sm" })}>Entendido</button>
        </Notice>
      )}

      {o.units.length > 0 &&
        (o.status === "aprobado" ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Ver los temas</summary>
            <UnitList institutionId={institutionId} units={o.units} />
          </details>
        ) : (
          <UnitList institutionId={institutionId} units={o.units} />
        ))}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </li>
  );
}

function UnitList({ institutionId, units }: { institutionId: string; units: ProgramUnit[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {units.map((u) => <UnitRow key={u.id} institutionId={institutionId} unit={u} />)}
    </ul>
  );
}

function UnitRow({ institutionId, unit }: { institutionId: string; unit: ProgramUnit }) {
  const { pending, error, run } = useRun();
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className={unit.hidden ? "text-muted-foreground line-through" : undefined}>
        {unit.title}
        {unit.source_page !== null && <span className="tabular-nums text-xs text-muted-foreground"> · p. {unit.source_page}</span>}
      </span>
      <span className="flex items-center gap-2">
        <Link href={`/unidad/${unit.id}`} className="text-xs underline underline-offset-2">Ver como estudiante</Link>
        {unit.hidden && <span className="text-xs text-muted-foreground">Oculto para Kemo</span>}
        <button type="button" disabled={pending} onClick={() => run(() => setUnitHidden(institutionId, unit.id, !unit.hidden))} className={action({ variant: "soft", size: "sm" })}>
          {unit.hidden ? "Mostrar" : "Ocultar"}
        </button>
      </span>
      {error && <span role="alert" className="w-full text-xs text-destructive">{error}</span>}
    </li>
  );
}
