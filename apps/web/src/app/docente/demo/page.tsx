import { busiestSubject, computeSectionMetrics } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/teacher/section-header";
import { SectionOverview } from "@/components/teacher/section-overview";
import { GoalPanel } from "@/components/teacher/goal-panel";
import { StreakPanel } from "@/components/teacher/streak-panel";
import { demoGamification } from "@/lib/gamification";
import { createClient } from "@/lib/supabase/server";
import { demoSource } from "@/lib/teacher";
import { cachedSummary } from "@/lib/teacher-summary";

export const metadata: Metadata = { title: "Panel docente: demostración" };

export default async function DemoSectionPage({ searchParams }: PageProps<"/docente/demo">) {
  const source = await demoSource();
  const metrics = computeSectionMetrics(source.data);
  const materia = (await searchParams).materia;
  const demo = await demoGamification(await createClient());
  const subjectId = metrics.subjects.find((s) => s.subjectId === materia)?.subjectId ?? busiestSubject(metrics);
  return (
    <div className="space-y-6">
      <SectionHeader source={source} />
      <p className="text-sm">
        <Link href="/docente/demo/guia" className="font-medium underline underline-offset-2">Ver cómo lo ve la persona guía del grupo</Link>
        {" "}(todas las materias).
      </p>
      <SectionOverview source={source} metrics={metrics} subjectId={subjectId} summary={await cachedSummary(metrics.findings)} />
      <GoalPanel data={demo} />
      <StreakPanel sectionId="demo" data={demo} demo />
    </div>
  );
}
