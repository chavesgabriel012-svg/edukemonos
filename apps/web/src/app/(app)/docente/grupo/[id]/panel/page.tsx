import { busiestSubject, computeSectionMetrics } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/teacher/section-header";
import { SectionOverview } from "@/components/teacher/section-overview";
import { requireStaff } from "@/lib/staff";
import { audit, groupSource } from "@/lib/teacher";
import { cachedSummary } from "@/lib/teacher-summary";

export const metadata: Metadata = { title: "Rendimiento del grupo" };

/** The guide's view: every student of the group, in every subject. */
export default async function GroupPanelPage({ params, searchParams }: PageProps<"/docente/grupo/[id]/panel">) {
  const { id } = await params;
  const { supabase, user } = await requireStaff(`/docente/grupo/${id}/panel`);
  const source = await groupSource(supabase, id, user.id);
  if (!source) notFound();
  await audit(supabase, user.id, "view_section", id);
  const metrics = computeSectionMetrics(source.data);
  const sp = await searchParams;
  const subjectId = metrics.subjects.find((s) => s.subjectId === sp.materia)?.subjectId ?? busiestSubject(metrics);
  return (
    <div className="space-y-6">
      <SectionHeader source={source} />
      {sp.retirado === "1" && <p role="status" className="rounded-[14px] bg-secondary px-4 py-2.5 text-sm">Listo: el estudiante ya no forma parte del grupo ni de sus materias.</p>}
      {source.data.students.length === 0 ? (
        <p className="rounded-[22px] border border-dashed p-6 text-muted-foreground">Todavía no hay estudiantes en el grupo.</p>
      ) : (
        <SectionOverview source={source} metrics={metrics} subjectId={subjectId} summary={await cachedSummary(metrics.findings)} />
      )}
    </div>
  );
}
