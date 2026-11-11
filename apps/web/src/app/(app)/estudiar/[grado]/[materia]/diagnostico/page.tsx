import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { eyebrow } from "@/components/ui/styles";
import { GRADE_LABEL, parseGrade, subjectName } from "@/lib/learn";
import { DiagnosticRunner } from "./runner";

export const metadata: Metadata = { title: "Prueba diagnóstica" };

export default async function DiagnosticPage({ params }: PageProps<"/estudiar/[grado]/[materia]/diagnostico">) {
  const { grado, materia } = await params;
  const grade = parseGrade(grado);
  const name = grade ? await subjectName(materia) : null;
  if (!grade || !name) notFound();
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <BackLink href={`/estudiar/${grade}/${materia}`}>{name} · {GRADE_LABEL[grade].toLowerCase()}</BackLink>
        <p className={eyebrow}>{name} · {grade}.º</p>
        <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Prueba diagnóstica</h1>
      </div>
      <DiagnosticRunner subject={materia} grade={grade} />
    </section>
  );
}
