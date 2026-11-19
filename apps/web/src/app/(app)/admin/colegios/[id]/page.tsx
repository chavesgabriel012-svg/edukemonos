import { MEP_2027, schoolChecklist } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarForm } from "@/app/(app)/docente/institucion/[id]/calendar-form";
import { InstitutionForm, type STATUS_LABEL } from "@/components/admin/institution-form";
import { OfferingGrid, type GridOffering } from "@/components/admin/offering-grid";
import { UsagePanel, type Usage } from "@/components/admin/usage-panel";
import { GroupsPanel } from "@/components/school/groups-panel";
import { PeoplePanel, type Member, type Person } from "@/components/school/people-panel";
import { ReassignSection } from "@/components/school/reassign-section";
import { CalendarSummary } from "@/components/teacher/calendar-summary";
import { action } from "@/components/ui/action";
import { BackLink } from "@/components/ui/back-link";
import { calendarFor } from "@/lib/gamification";
import { requireAdmin } from "@/lib/staff";
import { adminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Colegio" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "programa", label: "Programa" },
  { id: "personas", label: "Personas" },
  { id: "grupos", label: "Grupos" },
  { id: "uso", label: "Uso" },
] as const;

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/** One school, for the Eduka team: only aggregates, never student names, ids or chats. */
export default async function SchoolPage({ params, searchParams }: PageProps<"/admin/colegios/[id]">) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  if (!UUID.test(id)) notFound();
  const tabParam = (await searchParams).tab;
  const tab = TABS.find((t) => t.id === tabParam)?.id ?? "resumen";
  const { data: inst } = await supabase.from("institutions").select("id, name, slug, status, ai_monthly_budget_usd").eq("id", id).maybeSingle();
  if (!inst) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/admin">Colegios</BackLink>
        <h1 className="font-heading text-3xl font-bold">{inst.name}</h1>
      </div>

      <nav aria-label="Secciones del colegio" className="flex gap-1 overflow-x-auto rounded-[18px] border bg-card p-1.5">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/colegios/${id}?tab=${t.id}`} scroll={false} aria-current={t.id === tab ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-[14px] px-3 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 ${t.id === tab ? "bg-violeta text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "resumen" && <Summary supabase={supabase} inst={{ id, name: inst.name, slug: inst.slug, status: inst.status as keyof typeof STATUS_LABEL, budget: inst.ai_monthly_budget_usd === null ? null : Number(inst.ai_monthly_budget_usd) }} />}
      {tab === "programa" && <Program supabase={supabase} id={id} />}
      {tab === "personas" && <People supabase={supabase} id={id} />}
      {tab === "grupos" && <Groups supabase={supabase} id={id} />}
      {tab === "uso" && <UsageTab supabase={supabase} id={id} />}
    </div>
  );
}

const section = "space-y-4 rounded-[22px] border bg-card p-5 sm:p-6";

async function loadPeople(supabase: Supabase, id: string) {
  const { data } = await supabase.rpc("institution_people", { p_institution: id });
  const people = (data ?? []) as Person[];
  const members: Member[] = people.filter((p) => p.kind === "member" && p.profile_id).map((p) => ({ profile_id: p.profile_id as string, name: p.name, role: p.role }));
  return { people, members };
}

async function Summary({ supabase, inst }: { supabase: Supabase; inst: { id: string; name: string; slug: string | null; status: keyof typeof STATUS_LABEL; budget: number | null } }) {
  const [{ data: program }, { people }, { count: groups }, calendar] = await Promise.all([
    supabase.rpc("institution_program", { p_institution: inst.id }),
    loadPeople(supabase, inst.id),
    adminClient().from("groups").select("id", { count: "exact", head: true }).eq("institution_id", inst.id),
    calendarFor(supabase, { id: inst.id, name: inst.name }),
  ]);
  const teacherInvites = people.filter((p) => p.role === "teacher" && p.kind === "invite" && p.status !== "revocado");
  const checklist = schoolChecklist({
    approvedOfferings: ((program ?? []) as GridOffering[]).filter((o) => o.status === "aprobado").length,
    coordinatorsActive: people.filter((p) => p.kind === "member" && p.role === "admin" && p.status === "activo").length,
    invitesAccepted: people.filter((p) => p.kind === "member" && p.role === "teacher" && p.status === "activo").length,
    invitesPending: teacherInvites.filter((p) => p.status === "invitado").length,
    groups: groups ?? 0,
    smtpReady: process.env.EMAIL_SMTP_CONFIGURED === "true",
  });
  const own = calendar && calendar.owner !== "oficial";
  const initial = own
    ? { classesStart: calendar.classesStart, classesEnd: calendar.classesEnd, breaks: calendar.breaks, periods: calendar.periods }
    : { classesStart: MEP_2027.classesStart, classesEnd: MEP_2027.classesEnd, breaks: MEP_2027.breaks.map((b) => ({ ...b, label: "Vacaciones de medio año" })), periods: MEP_2027.periods };

  return (
    <>
      <section className={section}>
        <h2 className="font-heading text-2xl font-bold">Colegio</h2>
        <InstitutionForm school={inst} />
      </section>
      <section className={section}>
        <h2 className="font-heading text-2xl font-bold">Para empezar</h2>
        <ul className="space-y-2 text-sm">
          {checklist.map((c) => (
            <li key={c.key} className="flex items-start gap-2">
              <span aria-hidden className={c.done ? "font-bold text-violeta" : "text-muted-foreground"}>{c.done ? "✓" : "○"}</span>
              <span>{c.label}<span className="sr-only">{c.done ? ": listo" : ": pendiente"}</span></span>
            </li>
          ))}
        </ul>
      </section>
      <section className={section}>
        <h2 className="font-heading text-2xl font-bold">Calendario escolar</h2>
        <CalendarSummary calendar={calendar} />
        {!own && <p className="text-sm text-muted-foreground">El colegio todavía usa el calendario oficial del MEP.</p>}
        <details className="rounded-[16px] border p-4">
          <summary className="cursor-pointer font-medium">{own ? "Editar el calendario" : "Definir un calendario propio"}</summary>
          <div className="mt-4"><CalendarForm institutionId={inst.id} initial={initial} /></div>
        </details>
      </section>
    </>
  );
}

async function Program({ supabase, id }: { supabase: Supabase; id: string }) {
  const [{ data: subjects }, { data: program }, units] = await Promise.all([
    supabase.from("subjects").select("id, name, sort").order("sort"),
    supabase.rpc("institution_program", { p_institution: id }),
    publishedCommonUnits(supabase),
  ]);
  return (
    <section className={section}>
      <h2 className="font-heading text-2xl font-bold">Programa</h2>
      <p className="text-sm text-muted-foreground">Marque las materias que el colegio podrá aprobar. Solo la coordinación del colegio las aprueba o las retira.</p>
      <OfferingGrid institutionId={id} grades={[7, 8, 9]} subjects={(subjects ?? []).map((s) => ({ id: s.id, name: s.name }))} units={units} offerings={((program ?? []) as GridOffering[]).map((o) => ({ grade_id: o.grade_id, subject_id: o.subject_id, status: o.status }))} />
    </section>
  );
}

/** Grade and subject of every published unit of the common catalog (sources without a school). */
async function publishedCommonUnits(supabase: Supabase) {
  const seen = new Set<string>();
  const out: { grade_id: number; subject_id: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("curriculum_units").select("grade_id, subject_id, curriculum_sources!inner(institution_id)")
      .eq("status", "published").is("curriculum_sources.institution_id", null).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const u of data ?? []) {
      const key = `${u.grade_id}-${u.subject_id}`;
      if (!seen.has(key)) { seen.add(key); out.push({ grade_id: u.grade_id, subject_id: u.subject_id }); }
    }
    if ((data ?? []).length < 1000) return out;
  }
}

async function People({ supabase, id }: { supabase: Supabase; id: string }) {
  const { people, members } = await loadPeople(supabase, id);
  return (
    <section className={section}>
      <h2 className="font-heading text-2xl font-bold">Personas</h2>
      <PeoplePanel institutionId={id} people={people} members={members} />
    </section>
  );
}

async function Groups({ supabase, id }: { supabase: Supabase; id: string }) {
  const { members } = await loadPeople(supabase, id);
  // Groups and sections hold no student data; read with the service client after requireAdmin().
  const [{ data: groupRows }, { data: sectionRows }] = await Promise.all([
    adminClient().from("groups").select("id, name, grade_id, guide_id").eq("institution_id", id).order("grade_id").order("name"),
    adminClient().from("sections").select("id, name, teacher_id, groups!inner(institution_id)").eq("groups.institution_id", id).order("name"),
  ]);
  const groups = (groupRows ?? []).map((g) => ({ id: g.id, name: g.name, grade_id: g.grade_id, guide_name: members.find((m) => m.profile_id === g.guide_id)?.name ?? null }));
  const sections = (sectionRows ?? []).map((s) => ({ id: s.id, name: s.name, teacher_id: s.teacher_id }));
  return (
    <>
      <section className={section}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-bold">Grupos</h2>
          <Link href={`/admin/colegios/${id}/codigos`} className={action({ variant: "soft", size: "md" })}>Ver hoja de códigos</Link>
        </div>
        <GroupsPanel institutionId={id} groups={groups} />
      </section>
      <section className={section}>
        <h2 className="font-heading text-2xl font-bold">Secciones</h2>
        <ReassignSection sections={sections} members={members} />
      </section>
    </>
  );
}

async function UsageTab({ supabase, id }: { supabase: Supabase; id: string }) {
  const { data, error } = await supabase.rpc("admin_institution_usage", { p_institution: id });
  if (error) throw new Error(error.message);
  return (
    <section className={section}>
      <h2 className="font-heading text-2xl font-bold">Uso</h2>
      <UsagePanel usage={data as Usage} />
    </section>
  );
}
