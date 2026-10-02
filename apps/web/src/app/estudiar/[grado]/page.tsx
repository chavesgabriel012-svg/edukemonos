import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubjectIcon } from "@/components/brand/subject-icon";
import { subjectColor } from "@/lib/brand";
import { GRADE_LABEL, parseGrade, subjectsForGrade } from "@/lib/learn";

export const metadata: Metadata = { title: "Elige una materia" };

export default async function GradePage({ params }: PageProps<"/estudiar/[grado]">) {
  const grade = parseGrade((await params).grado);
  if (!grade) notFound();
  const subjects = await subjectsForGrade(grade);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link href="/" className="text-sm underline underline-offset-2">← Cambiar de año</Link>
        <h1 className="text-2xl font-bold">{GRADE_LABEL[grade]} año: elige una materia</h1>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {subjects.map((s) => (
          <li key={s.id}>
            {s.available ? (
              <Link href={`/estudiar/${grade}/${s.id}`} style={{ background: subjectColor(s.id) }}
                className="flex h-36 flex-col justify-between rounded-[20px] p-[18px] text-tinta transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2">
                <SubjectIcon subject={s.id} className="size-8" />
                <span className="font-heading text-xl leading-tight font-bold">{s.name}</span>
              </Link>
            ) : (
              <div className="flex h-36 flex-col justify-between rounded-[20px] border-2 border-dashed p-[18px] text-muted-foreground">
                <SubjectIcon subject={s.id} className="size-8" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-heading text-xl leading-tight font-bold">{s.name}</span>
                  <span className="font-mono text-xs">Próximamente</span>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
