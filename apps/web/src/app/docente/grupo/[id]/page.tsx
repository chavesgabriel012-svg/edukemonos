import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { regenerateGroupCode } from "@/app/docente/actions";
import { CopyButton } from "@/components/teacher/copy-button";
import { requireStaff } from "@/lib/staff";
import { formatCode } from "@/lib/teacher";
import { AddSubjectForm } from "./add-subject-form";
import { GuideForm } from "./guide-form";

export const metadata: Metadata = { title: "Grupo" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Overview {
  id: string;
  name: string;
  grade_id: number;
  join_code: string;
  active: boolean;
  institution: string | null;
  manages: boolean;
  can_teach: boolean;
  is_guide: boolean;
  guide: string | null;
  students: number;
  sections: { id: string; subject_id: string; subject: string; teacher: string; mine: boolean }[];
}

/** A group (e.g. 7-3): one code for every subject, its subject sections and its guide. */
export default async function GroupPage({ params }: PageProps<"/docente/grupo/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase } = await requireStaff(`/docente/grupo/${id}`);
  const [{ data, error }, { data: subjects }] = await Promise.all([
    supabase.rpc("group_overview", { p_group: id }),
    supabase.from("subjects").select("id, name, sort").order("sort"),
  ]);
  if (error || !data) notFound();
  const g = data as Overview;
  const code = formatCode(g.join_code);
  const free = (subjects ?? []).filter((s) => !g.sections.some((x) => x.subject_id === s.id));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/docente" className="text-sm underline underline-offset-2">← Mis secciones</Link>
        <p className="font-mono text-xs text-muted-foreground uppercase">{g.grade_id}.º año · grupo{g.institution ? ` · ${g.institution}` : ""}</p>
        <h1 className="font-heading text-4xl font-bold">{g.name}</h1>
        <p className="text-sm text-muted-foreground">{g.students} {g.students === 1 ? "estudiante" : "estudiantes"}</p>
      </div>

      <div className="rounded-[22px] bg-violeta p-5 text-white">
        <p className="text-sm text-white/80">Código del grupo: los estudiantes se unen una vez y quedan en todas sus materias</p>
        <p className="font-mono text-4xl font-bold tracking-[0.12em]" aria-label={`Código ${code.split("").join(" ")}`}>{code}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={code} />
          {g.manages && (
            <form action={regenerateGroupCode.bind(null, g.id)}>
              <button className="h-9 rounded-[10px] border border-white/25 px-3 text-sm font-medium transition hover:bg-white/10">Cambiar código</button>
            </form>
          )}
        </div>
      </div>

      <section className="space-y-3 rounded-[22px] border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Materias</h2>
        <p className="text-sm text-muted-foreground">Cada docente ve solo el avance de su materia.</p>
        {g.sections.length === 0 ? (
          <p className="text-sm">Todavía ninguna materia. Cada docente agrega la suya.</p>
        ) : (
          <ul className="divide-y rounded-[16px] border">
            {g.sections.map((s) => (
              <li key={s.id} className="flex min-h-11 items-center justify-between gap-3 p-3 text-sm">
                <span className="font-medium">{s.subject}</span>
                {s.mine ? (
                  <Link href={`/docente/seccion/${s.id}`} className="font-medium underline underline-offset-2">Su sección</Link>
                ) : (
                  <span className="text-muted-foreground">{s.teacher}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {g.can_teach && <AddSubjectForm groupId={g.id} subjects={free.map((s) => ({ id: s.id, name: s.name }))} />}
      </section>

      <section className="space-y-3 rounded-[22px] border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Persona guía</h2>
        <p className="text-sm">{g.guide ? `Guía: ${g.guide}.` : "Este grupo no tiene guía."}</p>
        {g.is_guide && (
          <Link href={`/docente/grupo/${g.id}/panel`} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
            Ver el rendimiento de todo el grupo
          </Link>
        )}
        {g.manages && <GuideForm groupId={g.id} hasGuide={Boolean(g.guide)} />}
      </section>
    </div>
  );
}
