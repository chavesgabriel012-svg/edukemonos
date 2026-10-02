import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
      <ul className="grid gap-3 sm:grid-cols-2">
        {subjects.map((s) => (
          <li key={s.id}>
            {s.available ? (
              <Link href={`/estudiar/${grade}/${s.id}`}
                className="flex items-center justify-between rounded-xl border p-4 text-lg font-medium transition hover:border-primary hover:bg-secondary">
                {s.name} <span aria-hidden>→</span>
              </Link>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-dashed p-4 text-lg text-muted-foreground">
                {s.name} <span className="text-xs">Próximamente</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
