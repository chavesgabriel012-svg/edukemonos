import { spendLevel } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { InstitutionForm, STATUS_LABEL } from "@/components/admin/institution-form";
import { SPEND_TEXT, usd } from "@/components/admin/usage-panel";
import { link } from "@/components/ui/styles";
import { requireAdmin } from "@/lib/staff";

export const metadata: Metadata = { title: "Consola Eduka" };

interface Row {
  id: string;
  name: string;
  status: keyof typeof STATUS_LABEL;
  teachers_invited: number;
  teachers_active: number;
  students: number;
  spend_month: number;
  budget: number | null;
}

/** Eduka team only: the schools with aggregate figures. Never names or data of students. */
export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_institutions_overview");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-3xl font-bold">Colegios</h1>
        <p className="text-sm text-muted-foreground">Cifras agregadas por colegio. Docentes activos / invitados.</p>
      </div>

      <section className="space-y-3 rounded-[22px] border bg-card p-5 sm:p-6">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay colegios. Cree el primero abajo.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="p-3 font-medium">Colegio</th>
                  <th scope="col" className="p-3 font-medium">Estado</th>
                  <th scope="col" className="p-3 text-right font-medium">Docentes</th>
                  <th scope="col" className="p-3 text-right font-medium">Estudiantes</th>
                  <th scope="col" className="p-3 text-right font-medium">IA del mes</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((r) => {
                  const level = spendLevel(Number(r.spend_month), r.budget === null ? null : Number(r.budget));
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <th scope="row" className="p-3 text-left font-medium"><Link href={`/admin/colegios/${r.id}`} className={link}>{r.name}</Link></th>
                      <td className="p-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                      <td className="p-3 text-right">{r.teachers_active}/{r.teachers_invited}</td>
                      <td className="p-3 text-right">{r.students}</td>
                      <td className={`p-3 text-right ${SPEND_TEXT[level]}`}>{usd(r.spend_month)} / {r.budget === null ? "sin tope" : usd(r.budget)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Nuevo colegio</h2>
        <InstitutionForm />
      </section>
    </div>
  );
}
