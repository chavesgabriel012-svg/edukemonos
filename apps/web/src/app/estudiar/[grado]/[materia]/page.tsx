import { levelMessage, STRONG, studyPath, WEAK } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubjectIcon } from "@/components/brand/subject-icon";
import { subjectColor } from "@/lib/brand";
import { currentUser, GRADE_LABEL, masteryMap, parseGrade, subjectName, unitsFor } from "@/lib/learn";

export async function generateMetadata({ params }: PageProps<"/estudiar/[grado]/[materia]">): Promise<Metadata> {
  const { grado, materia } = await params;
  const name = await subjectName(materia);
  return { title: name && parseGrade(grado) ? `${name} ${grado}.º` : "Temas" };
}

const STATUS = {
  reforzar: { label: "Conviene reforzar", cls: "bg-amber-100 text-amber-950" },
  por_explorar: { label: "Por explorar", cls: "bg-muted text-foreground" },
  dominado: { label: "Vas muy bien", cls: "bg-emerald-100 text-emerald-950" },
} as const;

function Bar({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground" aria-label={`Dominio estimado: ${pct} %`}>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
      </span>
      {pct} %
    </span>
  );
}

export default async function SubjectPage({ params }: PageProps<"/estudiar/[grado]/[materia]">) {
  const { grado, materia } = await params;
  const grade = parseGrade(grado);
  const name = grade ? await subjectName(materia) : null;
  if (!grade || !name) notFound();

  const units = await unitsFor(materia, grade);
  const mastery = await masteryMap(units.flatMap((u) => u.skills.map((s) => s.id)));
  const path = studyPath(units.map((u) => ({ ...u, skill_ids: u.skills.map((s) => s.id) })), mastery);
  const { supabase, user } = await currentUser();
  const { data: last } = user
    ? await supabase.from("diagnostics").select("id, estimated_level, completed_at").eq("student_id", user.id)
        .eq("subject_id", materia).eq("grade_id", grade).eq("status", "completed").order("completed_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };

  const strong = units.flatMap((u) => u.skills).filter((s) => (mastery.get(s.id) ?? 0) >= STRONG);
  const weak = units.flatMap((u) => u.skills).filter((s) => mastery.has(s.id) && mastery.get(s.id)! < WEAK);

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <Link href={`/estudiar/${grade}`} className="text-sm underline underline-offset-2">← Materias de {GRADE_LABEL[grade].toLowerCase()}</Link>
        <div style={{ background: subjectColor(materia) }} className="flex items-start justify-between gap-4 rounded-[22px] px-[22px] py-5 text-tinta">
          <h1 className="text-3xl leading-none font-bold">{name} · {grade}.º</h1>
          <SubjectIcon subject={materia} className="size-7" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-secondary/40 p-5">
        {last ? (
          <>
            <h2 className="text-lg font-semibold">Tu diagnóstico: nivel {Number(last.estimated_level).toFixed(1)} de 5</h2>
            <p>{levelMessage(Number(last.estimated_level))}</p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">¿Por dónde empiezo?</h2>
            <p>Haz una prueba diagnóstica corta (10 preguntas). Se adapta a tus respuestas y te sugiere qué temas estudiar primero.</p>
          </>
        )}
        <Link href={`/estudiar/${grade}/${materia}/diagnostico`}
          className="inline-block rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
          {last ? "Repetir el diagnóstico" : "Hacer el diagnóstico"}
        </Link>
      </div>

      {(strong.length > 0 || weak.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {strong.length > 0 && (
            <div className="rounded-xl border p-4">
              <h2 className="font-semibold">Vas muy bien en…</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{strong.slice(0, 5).map((s) => <li key={s.id}>{s.name}</li>)}</ul>
            </div>
          )}
          {weak.length > 0 && (
            <div className="rounded-xl border p-4">
              <h2 className="font-semibold">Conviene reforzar…</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{weak.slice(0, 5).map((s) => <li key={s.id}>{s.name}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">{mastery.size ? "Tu ruta sugerida" : "Temas"}</h2>
        {mastery.size > 0 && <p className="text-sm text-muted-foreground">Primero lo que conviene reforzar, luego lo que aún no exploras, en el orden del programa.</p>}
        <ol className="divide-y rounded-xl border">
          {path.map(({ unit, mastery: m, status }) => (
            <li key={unit.id}>
              <Link href={`/unidad/${unit.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50">
                <span>
                  <span className="block font-medium">{unit.title}</span>
                  {"area" in unit && unit.area ? <span className="text-xs text-muted-foreground">{String(unit.area)}</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  <Bar value={m} />
                  {mastery.size > 0 && <span className={`rounded px-2 py-0.5 text-xs ${STATUS[status].cls}`}>{STATUS[status].label}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
