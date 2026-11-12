import { computeSectionMetrics } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StudentDetail } from "@/components/teacher/student-detail";
import { demoSource } from "@/lib/teacher";

export const metadata: Metadata = { title: "Estudiante (demostración)" };

export default async function DemoStudentPage({ params }: PageProps<"/docente/demo/estudiante/[studentId]">) {
  const { studentId } = await params;
  const source = await demoSource();
  if (!source.data.students.some((s) => s.id === studentId)) notFound();
  return (
    <div className="space-y-4">
      <p role="note" className="rounded-[14px] bg-[#EEEBFE] px-4 py-2.5 text-sm"><strong>Datos de demostración:</strong> estudiante ficticio.</p>
      <StudentDetail source={source} metrics={computeSectionMetrics(source.data)} studentId={studentId} />
    </div>
  );
}
