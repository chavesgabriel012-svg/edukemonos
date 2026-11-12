import { busiestSubject, computeSectionMetrics } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/teacher/section-header";
import { SectionOverview } from "@/components/teacher/section-overview";
import { demoSource } from "@/lib/teacher";
import { cachedSummary } from "@/lib/teacher-summary";

export const metadata: Metadata = { title: "Panel de guía: demostración" };

/** What a group's guide sees: every student of the group in every subject (fictitious data). */
export default async function DemoGuidePage({ searchParams }: PageProps<"/docente/demo/guia">) {
  const source = await demoSource(true);
  const metrics = computeSectionMetrics(source.data);
  const materia = (await searchParams).materia;
  const subjectId = metrics.subjects.find((s) => s.subjectId === materia)?.subjectId ?? busiestSubject(metrics);
  return (
    <div className="space-y-6">
      <Link href="/docente/demo" className="text-sm underline underline-offset-2">← Ver como docente de Matemáticas</Link>
      <SectionHeader source={source} />
      <SectionOverview source={source} metrics={metrics} subjectId={subjectId} summary={await cachedSummary(metrics.findings)} />
    </div>
  );
}
