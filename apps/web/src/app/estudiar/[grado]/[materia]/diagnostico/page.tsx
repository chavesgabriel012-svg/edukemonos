import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GRADE_LABEL, parseGrade, subjectName } from "@/lib/learn";
import { DiagnosticRunner } from "./runner";

export const metadata: Metadata = { title: "Prueba diagnóstica" };

export default async function DiagnosticPage({ params }: PageProps<"/estudiar/[grado]/[materia]/diagnostico">) {
  const { grado, materia } = await params;
  const grade = parseGrade(grado);
  const name = grade ? await subjectName(materia) : null;
  if (!grade || !name) notFound();
  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link href={`/estudiar/${grade}/${materia}`} className="text-sm underline underline-offset-2">← {name} · {GRADE_LABEL[grade].toLowerCase()}</Link>
        <h1 className="text-2xl font-bold">Prueba diagnóstica de {name}</h1>
      </div>
      <DiagnosticRunner subject={materia} grade={grade} />
    </section>
  );
}
