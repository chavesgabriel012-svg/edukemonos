"use client";

import { setOffering } from "@/app/(app)/admin/actions";
import { useRun } from "@/components/school/run";

export interface GridOffering {
  grade_id: number;
  subject_id: string;
  status: "pendiente" | "aprobado" | "retirado";
}

/**
 * Grades by subjects of the common catalog. The Eduka team offers a subject once it has published
 * content; the school approves or withdraws it (never the team), so those states are read-only here.
 */
export function OfferingGrid({ institutionId, grades, subjects, units, offerings }: {
  institutionId: string;
  grades: number[];
  subjects: { id: string; name: string }[];
  units: { grade_id: number; subject_id: string }[];
  offerings: GridOffering[];
}) {
  const { pending, error, run } = useRun();
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[16px] border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-left">
              <th scope="col" className="p-3 font-medium">Año</th>
              {subjects.map((s) => <th key={s.id} scope="col" className="p-3 font-medium">{s.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g} className="border-b last:border-0">
                <th scope="row" className="p-3 text-left font-medium">{g}.º</th>
                {subjects.map((s) => {
                  const status = offerings.find((o) => o.grade_id === g && o.subject_id === s.id)?.status;
                  const hasContent = units.some((u) => u.grade_id === g && u.subject_id === s.id);
                  return (
                    <td key={s.id} data-cell={`${g}-${s.id}`} className="p-3 align-top">
                      {status === "aprobado" ? <span className="font-medium">Aprobado</span>
                        : status === "retirado" ? <span className="text-muted-foreground">Retirado</span>
                        : status === "pendiente" || hasContent ? (
                          <label className="flex min-h-11 items-center gap-2">
                            <input type="checkbox" checked={status === "pendiente"} disabled={pending} className="size-5"
                              onChange={(e) => run(() => setOffering(institutionId, g, s.id, e.target.checked))} />
                            <span>{status === "pendiente" ? "Pendiente de aprobación" : "Disponible"}</span>
                          </label>
                        ) : (
                          <label className="flex min-h-11 items-center gap-2 text-muted-foreground">
                            <input type="checkbox" disabled className="size-5" />
                            <span>Sin contenido</span>
                          </label>
                        )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
