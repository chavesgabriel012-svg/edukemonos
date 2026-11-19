import { MEP_2027 } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarSummary } from "@/components/teacher/calendar-summary";
import { GroupsPanel } from "@/components/school/groups-panel";
import { PeoplePanel, type Member, type Person } from "@/components/school/people-panel";
import { ProgramApproval, type ProgramOffering } from "@/components/school/program-approval";
import { ReassignSection } from "@/components/school/reassign-section";
import { calendarFor } from "@/lib/gamification";
import { requireStaff } from "@/lib/staff";
import { adminClient } from "@/lib/supabase/admin";
import { CalendarForm } from "./calendar-form";

export const metadata: Metadata = { title: "Institución" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InstitutionPage({ params }: PageProps<"/docente/institucion/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, user } = await requireStaff(`/docente/institucion/${id}`);
  const [{ data: inst }, { data: me }] = await Promise.all([
    supabase.from("institutions").select("id, name, slug").eq("id", id).maybeSingle(),
    supabase.from("institution_members").select("role").eq("institution_id", id).eq("profile_id", user.id).maybeSingle(),
  ]);
  if (!inst) notFound();
  const admin = me?.role === "admin";
  const calendar = await calendarFor(supabase, { id: inst.id, name: inst.name });
  const coordination = admin ? await loadCoordination(supabase, id) : null;
  const own = calendar && calendar.owner !== "oficial";
  const initial = own
    ? { classesStart: calendar.classesStart, classesEnd: calendar.classesEnd, breaks: calendar.breaks, periods: calendar.periods }
    : { classesStart: MEP_2027.classesStart, classesEnd: MEP_2027.classesEnd, breaks: MEP_2027.breaks.map((b) => ({ ...b, label: "Vacaciones de medio año" })), periods: MEP_2027.periods };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/docente" className="text-sm underline underline-offset-2">← Mis secciones</Link>
        <h1 className="font-heading text-3xl font-bold">{inst.name}</h1>
        <p className="tabular-nums text-xs text-muted-foreground">ID {inst.id}{inst.slug ? ` · ${inst.slug}` : ""}</p>
      </div>

      <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-bold">Calendario escolar</h2>
        <CalendarSummary calendar={calendar} />
        {!own && <p className="text-sm text-muted-foreground">La institución todavía usa el calendario oficial del MEP.</p>}
        {admin ? (
          <details className="rounded-[16px] border p-4" open={!own}>
            <summary className="cursor-pointer font-medium">{own ? "Editar el calendario" : "Definir un calendario propio"}</summary>
            <div className="mt-4"><CalendarForm institutionId={inst.id} initial={initial} /></div>
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">Solo quien administra la institución puede cambiar el calendario.</p>
        )}
      </section>

      {coordination && (
        <>
          <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
            <h2 className="font-heading text-2xl font-bold">Programa</h2>
            <p className="text-sm text-muted-foreground">Estudiantes y Kemo solo ven las materias que usted aprueba. Puede ocultar temas que su colegio no va a ver este año.</p>
            <ProgramApproval institutionId={inst.id} program={coordination.program} />
          </section>

          <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
            <h2 className="font-heading text-2xl font-bold">Personas</h2>
            <PeoplePanel institutionId={inst.id} people={coordination.people} members={coordination.members} />
          </section>

          <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
            <h2 className="font-heading text-2xl font-bold">Grupos</h2>
            <GroupsPanel institutionId={inst.id} groups={coordination.groups} />
          </section>

          <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
            <h2 className="font-heading text-2xl font-bold">Secciones</h2>
            <ReassignSection sections={coordination.sections} members={coordination.members} />
          </section>
        </>
      )}
    </div>
  );
}

/** Everything the coordination panels show. Only called after checking the user is the school's coordinator. */
async function loadCoordination(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], id: string) {
  const [{ data: program }, { data: peopleRows }, { data: groupRows }] = await Promise.all([
    supabase.rpc("institution_program", { p_institution: id }),
    supabase.rpc("institution_people", { p_institution: id }),
    supabase.from("groups").select("id, name, grade_id, guide_id").eq("institution_id", id).order("grade_id").order("name"),
  ]);
  const people = (peopleRows ?? []) as Person[];
  const members: Member[] = people.filter((p) => p.kind === "member" && p.profile_id).map((p) => ({ profile_id: p.profile_id as string, name: p.name, role: p.role }));
  const groups = (groupRows ?? []).map((g) => ({ id: g.id, name: g.name, grade_id: g.grade_id, guide_name: members.find((m) => m.profile_id === g.guide_id)?.name ?? null }));
  // Coordination cannot read other teachers' sections through RLS, so this reads only the school's
  // section names and teachers (no students) with the service client, after the role check above.
  const { data: sectionRows } = await adminClient().from("sections").select("id, name, teacher_id, groups!inner(institution_id)").eq("groups.institution_id", id).order("name");
  const sections = (sectionRows ?? []).map((s) => ({ id: s.id, name: s.name, teacher_id: s.teacher_id }));
  return { program: (program ?? []) as ProgramOffering[], people, members, groups, sections };
}
