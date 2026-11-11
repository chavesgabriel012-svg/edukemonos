import { busiestSubject, computeSectionMetrics } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/teacher/section-header";
import { SectionOverview } from "@/components/teacher/section-overview";
import { requireStaff } from "@/lib/staff";
import { audit, sectionSource } from "@/lib/teacher";
import { cachedSummary } from "@/lib/teacher-summary";

export const metadata: Metadata = { title: "Sección" };

const ACTION = { view_section: "Vio la sección", view_student: "Vio a un estudiante", export_csv: "Descargó el CSV", remove_student: "Sacó a un estudiante", ai_summary: "Pidió el resumen con IA" } as Record<string, string>;

export default async function SectionPage({ params, searchParams }: PageProps<"/docente/seccion/[id]">) {
  const { id } = await params;
  const { supabase, user } = await requireStaff(`/docente/seccion/${id}`);
  const source = await sectionSource(supabase, id, user.id);
  if (!source) notFound();
  await audit(supabase, user.id, "view_section", id);

  const metrics = computeSectionMetrics(source.data);
  const sp = await searchParams;
  const subjectId = metrics.subjects.find((s) => s.subjectId === sp.materia)?.subjectId ?? busiestSubject(metrics);
  const { data: log } = await supabase
    .from("teacher_audit_log")
    .select("action, created_at")
    .eq("section_id", id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-6">
      <SectionHeader source={source} />
      {sp.retirado === "1" && <p role="status" className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">Listo: el estudiante ya no forma parte de la sección.</p>}
      {source.data.students.length === 0 ? (
        <div className="space-y-2 rounded-[22px] border border-dashed p-6">
          <h2 className="font-heading text-2xl font-bold">Todavía no hay estudiantes</h2>
          <p className="text-muted-foreground">
            Pida a sus estudiantes que entren a Eduka, toquen «Únete a tu sección» y escriban el código de arriba. Cuando
            empiecen a practicar, aquí verá su avance.
          </p>
        </div>
      ) : (
        <SectionOverview source={source} metrics={metrics} subjectId={subjectId} summary={await cachedSummary(metrics.findings)} />
      )}
      <details className="rounded-[22px] border bg-card p-5 text-sm">
        <summary className="cursor-pointer font-medium">Registro de accesos</summary>
        <p className="mt-2 text-muted-foreground">Cada vez que alguien abre esta sección, un estudiante o descarga datos, queda registrado.</p>
        <ul className="mt-3 space-y-1">
          {(log ?? []).map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{ACTION[l.action] ?? l.action}</span>
              <span className="font-mono text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
