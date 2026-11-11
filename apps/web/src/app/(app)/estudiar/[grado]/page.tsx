import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubjectIcon } from "@/components/brand/subject-icon";
import { BackLink } from "@/components/ui/back-link";
import { eyebrow } from "@/components/ui/styles";
import { subjectColor } from "@/lib/brand";
import { GRADE_LABEL, parseGrade, subjectsForGrade } from "@/lib/learn";

export const metadata: Metadata = { title: "Elige una materia" };

export default async function GradePage({ params }: PageProps<"/estudiar/[grado]">) {
  const grade = parseGrade((await params).grado);
  if (!grade) notFound();
  const subjects = await subjectsForGrade(grade);
  const available = subjects.filter((s) => s.available);
  const upcoming = subjects.filter((s) => !s.available);

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <BackLink href="/estudiar">Cambiar de año</BackLink>
        <p className={eyebrow}>{GRADE_LABEL[grade]} año</p>
        <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Elige una materia</h1>
      </div>

      {available.length === 0 ? (
        <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">Todavía no hay materias publicadas para este año.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {available.map((s) => (
            <li key={s.id}>
              <Link href={`/estudiar/${grade}/${s.id}`} style={{ background: subjectColor(s.id) }}
                className="group flex h-44 flex-col justify-between rounded-[22px] p-6 text-tinta transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(23,19,42,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2">
                <span className="flex items-start justify-between">
                  <SubjectIcon subject={s.id} className="size-9" />
                  <span className="rounded-full bg-tinta/10 px-3 py-1 font-mono text-xs uppercase">{grade}.º</span>
                </span>
                <span className="flex items-end justify-between gap-3">
                  <span className="font-heading text-3xl leading-none font-bold">{s.name}</span>
                  <span aria-hidden className="text-2xl transition group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className={eyebrow}>Próximamente</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-[16px] border-2 border-dashed px-3.5 py-3 text-muted-foreground">
                <SubjectIcon subject={s.id} className="size-5 shrink-0" />
                <span className="text-sm leading-tight font-medium">{s.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
