import { busiestSubject, computeSectionMetrics } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import { SectionHeader } from "@/components/teacher/section-header";
import { SectionOverview } from "@/components/teacher/section-overview";
import { demoSource } from "@/lib/teacher";
import { cachedSummary } from "@/lib/teacher-summary";

export const metadata: Metadata = { title: "Panel docente: demostración" };

export default async function DemoSectionPage({ searchParams }: PageProps<"/docente/demo">) {
  const source = await demoSource();
  const metrics = computeSectionMetrics(source.data);
  const materia = (await searchParams).materia;
  const subjectId = metrics.subjects.find((s) => s.subjectId === materia)?.subjectId ?? busiestSubject(metrics);
  return (
    <div className="space-y-6">
      <SectionHeader source={source} />
      <SectionOverview source={source} metrics={metrics} subjectId={subjectId} summary={await cachedSummary(metrics.findings)} />
    </div>
  );
}
