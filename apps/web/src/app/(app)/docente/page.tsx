import { BarChart3, Download, Grid3x3, ShieldCheck, Sparkles, UserRoundSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { SectionsGlance } from "@/components/teacher/sections-glance";
import { formatCode, teacherGlance } from "@/lib/teacher";
import { NewGroupForm } from "./new-group-form";
import { NewSectionForm } from "./new-section-form";

export const metadata: Metadata = {
  title: "Panel docente",
  description: "Secciones con código, mapa de calor por tema, estudiantes que podrían necesitar apoyo y un resumen con IA que explica cómo se calculó.",
};

const FEATURES = [
  { icon: Grid3x3, title: "Mapa de calor por tema", text: "El dominio estimado de cada estudiante en cada tema, con los temas reales del programa del MEP." },
  { icon: UserRoundSearch, title: "Quién podría necesitar apoyo", text: "Dominio bajo o sin actividad en la semana, con la razón a la vista. Una señal para conversar, no una etiqueta." },
  { icon: Sparkles, title: "Resumen con IA", text: "Propone qué hacer en clase y muestra «¿Cómo se calculó?» con los números de cada hallazgo." },
  { icon: BarChart3, title: "Detalle por estudiante", text: "Nivel por materia, temas, errores de escritura por tipo, temas consultados al tutor y línea de tiempo." },
  { icon: Download, title: "Exportar a CSV", text: "Una fila por estudiante para trabajar en hoja de cálculo." },
  { icon: ShieldCheck, title: "Privacidad primero", text: "El panel nunca muestra lo que escriben al tutor, los nombres no llegan a la IA y cada acceso queda registrado." },
] as const;

function Landing() {
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[28px] bg-violeta px-6 pt-8 pb-24 text-white sm:px-10 sm:py-12">
        <div className="relative z-10 max-w-xl space-y-4">
          <h1 className="font-heading text-[2.4rem] leading-[0.95] font-bold sm:text-6xl">
            Sepa qué necesita su sección
            <span className="block text-lima">esta semana.</span>
          </h1>
          <p className="text-lg text-white/85">
            Cree una sección, comparta el código y vea cómo avanza cada estudiante en los temas del programa.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/docente/demo" className="inline-flex h-[52px] items-center rounded-[14px] bg-lima px-6 font-semibold text-tinta transition hover:bg-[#b5e51f]">
              Ver la demostración
            </Link>
            <Link href="/entrar?next=/docente" className="inline-flex h-[52px] items-center rounded-[14px] border-2 border-white/70 px-6 font-semibold transition hover:bg-white/10">
              Entrar con mi correo
            </Link>
          </div>
        </div>
        <Kemo size={168} mood="normal" background={brand.lima}
          className="pointer-events-none absolute -right-6 -bottom-8 size-[120px] rotate-[8deg] sm:right-10 sm:bottom-8 sm:size-[190px]" />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="space-y-2 rounded-[22px] bg-card p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-lima text-tinta"><Icon aria-hidden strokeWidth={2.5} className="size-5" /></span>
            <h2 className="font-heading text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function TeacherHomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.is_anonymous) return <Landing />;

  const { data: memberships } = await supabase
    .from("institution_members")
    .select("role, institutions(id, name)")
    .eq("profile_id", auth.user.id);
  const institutions = (memberships ?? []).flatMap((m) => {
    const i = m.institutions as unknown as { id: string; name: string } | null;
    return i ? [{ ...i, admin: m.role === "admin" }] : [];
  });

  const [{ data: sections }, { data: groups }, { data: subjects }] = await Promise.all([
    supabase
      .from("sections")
      .select("id, name, grade_id, join_code, active, current_term, subject_id, subjects(name), groups(name, join_code), section_members(count)")
      .eq("teacher_id", auth.user.id)
      .order("created_at", { ascending: false }),
    // Groups visible to the teacher: theirs, the ones they guide or teach in, and those of their institutions.
    supabase.from("groups").select("id, name, grade_id, guide_id, created_by, sections(teacher_id)").order("name"),
    supabase.from("subjects").select("id, name").order("sort"),
  ]);
  const role = (g: { guide_id: string | null; created_by: string; sections: { teacher_id: string }[] }) =>
    g.guide_id === auth.user!.id ? "Guía" : g.sections.some((x) => x.teacher_id === auth.user!.id) ? "Doy una materia" : g.created_by === auth.user!.id ? "Lo creé" : "De mi institución";

  // Shown while the overview of every section (same numbers as each panel) is computed.
  const simple = (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(sections ?? []).map((s) => {
        const members = (s.section_members as unknown as { count: number }[])[0]?.count ?? 0;
        return (
          <li key={s.id}>
            <Link href={`/docente/seccion/${s.id}`} className="flex h-full flex-col gap-2 rounded-[22px] border bg-card p-5 transition hover:border-violeta">
              <span className="font-mono text-xs text-muted-foreground">{s.grade_id}.º AÑO</span>
              <span className="font-heading text-2xl leading-none font-bold">{s.name}</span>
              <span className="text-sm text-muted-foreground">
                {(s.subjects as unknown as { name: string } | null)?.name ?? "Todas las materias"} · {members} {members === 1 ? "estudiante" : "estudiantes"}
              </span>
              <span className="mt-auto flex items-center justify-between pt-2 text-sm">
                <span className="font-mono font-semibold tracking-wider">
                  {formatCode((s.groups as unknown as { join_code: string } | null)?.join_code ?? s.join_code)}
                </span>
                {!s.active && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">código desactivado</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-4xl font-bold">Mis secciones</h1>
          <Link href="/docente/demo/resumen" className="text-sm font-medium underline underline-offset-2">Ver la demostración</Link>
        </div>
        {!sections?.length ? (
          <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">
            Todavía no tiene secciones. Cree la primera abajo: Eduka le da un código para que sus estudiantes se unan.
          </p>
        ) : (
          <Suspense fallback={simple}>
            <Glance teacherId={auth.user.id} />
          </Suspense>
        )}
      </section>
      {(groups ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-2xl font-bold">Grupos</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(groups ?? []).map((g) => (
              <li key={g.id}>
                <Link href={`/docente/grupo/${g.id}`} className="flex h-full flex-col gap-1 rounded-[22px] border bg-card p-4 transition hover:border-violeta">
                  <span className="font-mono text-xs text-muted-foreground">{g.grade_id}.º AÑO · GRUPO</span>
                  <span className="font-heading text-2xl leading-none font-bold">{g.name}</span>
                  <span className="text-sm text-muted-foreground">{role(g)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {institutions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-2xl font-bold">Mis instituciones</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {institutions.map((i) => (
              <li key={i.id}>
                <Link href={`/docente/institucion/${i.id}`} className="flex min-h-11 items-center justify-between rounded-[22px] border bg-card p-4 transition hover:border-violeta">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-xs text-muted-foreground">{i.admin ? "Administración" : "Docente"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Agregar mi materia o crear una sección</h2>
        <NewSectionForm groups={(groups ?? []).map((g) => ({ id: g.id, name: `${g.name} (${g.grade_id}.º)` }))} subjects={subjects ?? []} />
      </section>
      <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Crear un grupo</h2>
        <p className="text-sm text-muted-foreground">
          Un grupo (por ejemplo, 7-3) tiene un solo código: sus estudiantes se unen una vez y quedan en todas las materias. Cada
          docente agrega su materia y ve solo esa. Se puede asignar una persona guía, que ve todas las materias del grupo.
        </p>
        <NewGroupForm institutions={institutions.filter((i) => i.admin).map((i) => ({ id: i.id, name: i.name }))} />
      </section>
    </div>
  );
}

/** Every section of the teacher, side by side by subject, with who could need support in each. */
async function Glance({ teacherId }: { teacherId: string }) {
  const supabase = await createClient();
  return <SectionsGlance sections={await teacherGlance(supabase, teacherId)} />;
}
