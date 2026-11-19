import { BarChart3, Download, Grid3x3, ShieldCheck, Sparkles, UserRoundSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { SectionsGlance } from "@/components/teacher/sections-glance";
import { formatCode, teacherGlance } from "@/lib/teacher";
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
            Su colegio lo invita a Eduka. Usted comparte el código de su grupo y ve cómo avanza cada estudiante en los temas del programa.
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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * The schools of the signed-in person, with whether they coordinate each one. `fresh` reads them again
 * in the same render: an identical GET would be memoized and return the first answer, so it opts out
 * with its own AbortSignal.
 */
async function myInstitutions(supabase: Supabase, uid: string, fresh = false) {
  const query = supabase
    .from("institution_members")
    .select("role, institutions(id, name)")
    .eq("profile_id", uid);
  const { data: memberships } = await (fresh ? query.abortSignal(new AbortController().signal) : query);
  return (memberships ?? []).flatMap((m) => {
    const i = m.institutions as unknown as { id: string; name: string } | null;
    return i ? [{ ...i, admin: m.role === "admin" }] : [];
  });
}

/** The way into the coordination page, for each school whose program is still waiting for the coordinator. */
function ReviewProgram({ schools }: { schools: { id: string; name: string }[] }) {
  if (!schools.length) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {schools.map((s) => (
        <li key={s.id}>
          <Link href={`/docente/institucion/${s.id}`} className="flex h-full flex-col gap-1 rounded-[22px] bg-violeta p-5 text-white transition hover:bg-violeta/90">
            <span className="text-sm text-white/80">Coordinación · {s.name}</span>
            <span className="font-heading text-2xl leading-tight font-bold">Revise y apruebe el programa de su colegio</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function TeacherHomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.is_anonymous) return <Landing />;

  let institutions = await myInstitutions(supabase, auth.user.id);
  if (institutions.length === 0) {
    // Someone invited who already had a session never goes through /auth/confirm: link them here.
    const { data: claimed, error } = await supabase.rpc("claim_my_invites");
    if (error) console.error("claim_my_invites failed", error.message);
    else if (claimed) institutions = await myInstitutions(supabase, auth.user.id, true);
  }

  // A teacher without a school has nothing to do here: the school invites them (spec «Invitaciones y acceso docente»).
  if (institutions.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-4xl font-bold">Panel docente</h1>
        <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">
          Su colegio todavía no le dio acceso a Eduka. Si ya debería tenerlo, pídale a la coordinación que lo invite.
        </p>
        <Link href="/docente/demo" className="text-sm font-medium underline underline-offset-2">Ver la demostración</Link>
      </div>
    );
  }

  const [{ data: sections }, { data: groups }, { data: subjects }, { data: programs }] = await Promise.all([
    supabase
      .from("sections")
      .select("id, name, grade_id, join_code, active, current_term, subject_id, subjects(name), groups(name, join_code), section_members(count)")
      .eq("teacher_id", auth.user.id)
      .order("created_at", { ascending: false }),
    // Groups visible to the teacher: theirs, the ones they guide or teach in, and those of their institutions.
    supabase.from("groups").select("id, name, grade_id, institution_id, guide_id, created_by, sections(teacher_id)").order("name"),
    supabase.from("subjects").select("id, name").order("sort"),
    // Readable by the school's members (RLS); only approved subjects can have sections.
    supabase.from("institution_offerings").select("institution_id, grade_id, subject_id, status").in("status", ["aprobado", "pendiente"]),
  ]);
  const offerings = (programs ?? []).filter((o) => o.status === "aprobado");
  // Coordinators whose school still has subjects to approve, or none approved yet, are sent to approve them.
  const toReview = institutions.filter(
    (i) => i.admin && ((programs ?? []).some((o) => o.institution_id === i.id && o.status === "pendiente") || !offerings.some((o) => o.institution_id === i.id)),
  );
  if (!offerings.length && !sections?.length && !groups?.length) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-4xl font-bold">Panel docente</h1>
        <ReviewProgram schools={toReview} />
        {institutions.some((i) => !i.admin) && (
          <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">Su colegio está terminando de preparar Eduka.</p>
        )}
        <Link href="/docente/demo" className="text-sm font-medium underline underline-offset-2">Ver la demostración</Link>
      </div>
    );
  }
  const role = (g: { guide_id: string | null; created_by: string; sections: { teacher_id: string }[] }) =>
    g.guide_id === auth.user!.id ? "Guía" : g.sections.some((x) => x.teacher_id === auth.user!.id) ? "Doy una materia" : g.created_by === auth.user!.id ? "Lo creé" : "De mi institución";

  const schoolGroups = (groups ?? []).filter((g) => g.institution_id);

  // Shown while the overview of every section (same numbers as each panel) is computed.
  const simple = (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(sections ?? []).map((s) => {
        const members = (s.section_members as unknown as { count: number }[])[0]?.count ?? 0;
        return (
          <li key={s.id}>
            <Link href={`/docente/seccion/${s.id}`} className="flex h-full flex-col gap-2 rounded-[22px] border bg-card p-5 transition hover:border-violeta">
              <span className="tabular-nums text-xs text-muted-foreground">{s.grade_id}.º año</span>
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
      <ReviewProgram schools={toReview} />
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-4xl font-bold">Mis secciones</h1>
          <Link href="/docente/demo/resumen" className="text-sm font-medium underline underline-offset-2">Ver la demostración</Link>
        </div>
        {!sections?.length ? (
          <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">
            {offerings.length
              ? "Todavía no tiene secciones. Cree la primera abajo: Eduka le da un código para que sus estudiantes se unan."
              : "Todavía no tiene secciones."}
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
                  <span className="tabular-nums text-xs text-muted-foreground">{g.grade_id}.º año · grupo</span>
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
      {/* Withdrawn subjects keep their sections and progress (spec): only a new section needs an approved one. */}
      {offerings.length > 0 ? (
        <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
          <h2 className="font-heading text-2xl font-bold">Agregar mi materia a un grupo</h2>
          <NewSectionForm
            groups={schoolGroups.map((g) => ({
              id: g.id,
              name: `${g.name} (${g.grade_id}.º)`,
              subjectIds: offerings
                .filter((o) => o.institution_id === g.institution_id && o.grade_id === g.grade_id)
                .map((o) => o.subject_id),
            }))}
            subjects={subjects ?? []}
          />
        </section>
      ) : (
        institutions.some((i) => !i.admin) && (
          <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">Su colegio está terminando de preparar Eduka.</p>
        )
      )}
    </div>
  );
}

/** Every section of the teacher, side by side by subject, with who could need support in each. */
async function Glance({ teacherId }: { teacherId: string }) {
  const supabase = await createClient();
  return <SectionsGlance sections={await teacherGlance(supabase, teacherId)} />;
}
