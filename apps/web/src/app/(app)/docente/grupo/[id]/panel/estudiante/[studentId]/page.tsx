import { computeSectionMetrics } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { removeGroupMember } from "@/app/(app)/docente/actions";
import { StudentDetail } from "@/components/teacher/student-detail";
import { requireStaff } from "@/lib/staff";
import { audit, groupSource } from "@/lib/teacher";

export const metadata: Metadata = { title: "Estudiante" };

export default async function GroupStudentPage({ params }: PageProps<"/docente/grupo/[id]/panel/estudiante/[studentId]">) {
  const { id, studentId } = await params;
  const { supabase, user } = await requireStaff(`/docente/grupo/${id}/panel/estudiante/${studentId}`);
  const source = await groupSource(supabase, id, user.id);
  if (!source || !source.data.students.some((s) => s.id === studentId)) notFound();
  await audit(supabase, user.id, "view_student", id, studentId);
  const remove = (
    <details className="relative">
      <summary className="cursor-pointer rounded-[12px] border px-4 py-2 text-sm font-medium hover:bg-secondary">Sacar del grupo</summary>
      <form action={removeGroupMember.bind(null, id, studentId)} className="absolute right-0 z-10 mt-2 w-72 space-y-3 rounded-[16px] border bg-card p-4 text-sm shadow-lg">
        <p>Sale del grupo y de todas sus materias. Su cuenta y su práctica no se borran: puede volver a unirse con el código.</p>
        <button className="h-10 w-full rounded-[12px] bg-destructive font-medium text-white">Sí, sacarlo del grupo</button>
      </form>
    </details>
  );
  return <StudentDetail source={source} metrics={computeSectionMetrics(source.data)} studentId={studentId} actions={remove} />;
}
