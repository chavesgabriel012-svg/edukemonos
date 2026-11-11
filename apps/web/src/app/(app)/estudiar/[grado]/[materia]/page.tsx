import { levelMessage, STRONG, studyPath, WEAK } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Kemo } from "@/components/brand/logo";
import { SubjectIcon } from "@/components/brand/subject-icon";
import { action } from "@/components/ui/action";
import { BackLink } from "@/components/ui/back-link";
import { eyebrow } from "@/components/ui/styles";
import { brand, subjectColor } from "@/lib/brand";
import { currentUser, GRADE_LABEL, masteryMap, parseGrade, subjectName, unitsFor } from "@/lib/learn";

export async function generateMetadata({ params }: PageProps<"/estudiar/[grado]/[materia]">): Promise<Metadata> {
  const { grado, materia } = await params;
  const name = await subjectName(materia);
  return { title: name && parseGrade(grado) ? `${name} ${grado}.º` : "Temas" };
}

const STATUS = {
  reforzar: { label: "Conviene reforzar", cls: "bg-[#FBF1D9] text-[#6B4A00]" },
  por_explorar: { label: "Por explorar", cls: "bg-secondary text-foreground" },
  dominado: { label: "Vas muy bien", cls: "bg-lima text-tinta" },
} as const;

function Bar({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return (
    <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground" aria-label={`Dominio estimado: ${pct} %`}>
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-violeta" style={{ width: `${pct}%` }} />
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
  const hasProgress = mastery.size > 0;

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <BackLink href={`/estudiar/${grade}`}>Materias de {GRADE_LABEL[grade].toLowerCase()}</BackLink>
        <div style={{ background: subjectColor(materia) }} className="flex items-end justify-between gap-4 rounded-[28px] px-6 py-7 text-tinta sm:px-8 sm:py-9">
          <div className="space-y-2">
            <p className="font-mono text-xs tracking-wide uppercase">{GRADE_LABEL[grade]} año · {units.length} {units.length === 1 ? "tema" : "temas"}</p>
            <h1 className="font-heading text-4xl leading-none font-bold sm:text-6xl">{name}</h1>
          </div>
          <SubjectIcon subject={materia} className="size-10 shrink-0 sm:size-14" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[22px] bg-tinta p-5 text-papel sm:flex-row sm:items-center sm:p-6">
        <Kemo size={64} mood={last ? "happy" : "down"} background={brand.lima} className="hidden sm:block" />
        <div className="flex-1 space-y-1">
          {last ? (
            <>
              <p className="font-mono text-xs tracking-wide text-lima uppercase">Tu diagnóstico</p>
              <h2 className="font-heading text-2xl leading-tight font-bold">Nivel {Number(last.estimated_level).toFixed(1).replace(".", ",")} de 5</h2>
              <p className="text-papel/80">{levelMessage(Number(last.estimated_level))}</p>
            </>
          ) : (
            <>
              <p className="font-mono text-xs tracking-wide text-lima uppercase">¿Por dónde empiezo?</p>
              <h2 className="font-heading text-2xl leading-tight font-bold">Haz el diagnóstico</h2>
              <p className="text-papel/80">10 preguntas que se adaptan a tus respuestas y te sugieren qué temas estudiar primero. No tiene nota.</p>
            </>
          )}
        </div>
        <Link href={`/estudiar/${grade}/${materia}/diagnostico`} className={action({ variant: last ? "outline-on-dark" : "lima-on-dark" })}>
          {last ? "Repetir el diagnóstico" : "Hacer el diagnóstico"}
        </Link>
      </div>

      {(strong.length > 0 || weak.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {weak.length > 0 && (
            <div className="rounded-[22px] border bg-card p-5">
              <h2 className="font-heading text-xl font-bold">Conviene reforzar</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{weak.slice(0, 5).map((s) => <li key={s.id}>{s.name}</li>)}</ul>
            </div>
          )}
          {strong.length > 0 && (
            <div className="rounded-[22px] border bg-card p-5">
              <h2 className="font-heading text-xl font-bold">Vas muy bien en</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{strong.slice(0, 5).map((s) => <li key={s.id}>{s.name}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-heading text-3xl font-bold">{hasProgress ? "Tu ruta sugerida" : "Temas"}</h2>
          <p className="text-sm text-muted-foreground">
            {hasProgress
              ? "Primero lo que conviene reforzar, luego lo que aún no exploras, en el orden del programa."
              : "En el orden del programa. Cuando practiques o hagas el diagnóstico, se ordenan según lo que más te conviene."}
          </p>
        </div>
        {path.length === 0 ? (
          <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">Todavía no hay temas publicados para esta materia.</p>
        ) : (
          <ol className="space-y-2">
            {path.map(({ unit, mastery: m, status }, i) => (
              <li key={unit.id}>
                <Link href={`/unidad/${unit.id}`}
                  className="group flex items-center gap-4 rounded-[18px] border bg-card p-4 transition hover:border-violeta hover:shadow-[0_12px_32px_-16px_rgba(23,19,42,0.2)] focus-visible:outline-2">
                  <span aria-hidden style={{ background: subjectColor(materia) }} className="flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-semibold text-tinta">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-semibold">{unit.title}</span>
                    {"area" in unit && unit.area ? <span className={`${eyebrow} mt-0.5 block`}>{String(unit.area)}</span> : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                    <Bar value={m} />
                    {hasProgress && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[status].cls}`}>{STATUS[status].label}</span>}
                  </span>
                  <span aria-hidden className="hidden text-xl text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-violeta sm:block">→</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
