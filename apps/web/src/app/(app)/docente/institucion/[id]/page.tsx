import { MEP_2027 } from "@edukemonos/curriculum";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarSummary } from "@/components/teacher/calendar-summary";
import { calendarFor } from "@/lib/gamification";
import { requireStaff } from "@/lib/staff";
import { CalendarForm } from "./calendar-form";
import { MemberForm } from "./member-form";

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
  const { data: members } = admin ? await supabase.rpc("institution_member_list", { p_institution: id }) : { data: null };
  const own = calendar && calendar.owner !== "oficial";
  const initial = own
    ? { classesStart: calendar.classesStart, classesEnd: calendar.classesEnd, breaks: calendar.breaks, periods: calendar.periods }
    : { classesStart: MEP_2027.classesStart, classesEnd: MEP_2027.classesEnd, breaks: MEP_2027.breaks.map((b) => ({ ...b, label: "Vacaciones de medio año" })), periods: MEP_2027.periods };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/docente" className="text-sm underline underline-offset-2">← Mis secciones</Link>
        <h1 className="font-heading text-3xl font-bold">{inst.name}</h1>
        <p className="font-mono text-xs text-muted-foreground">ID {inst.id}{inst.slug ? ` · ${inst.slug}` : ""}</p>
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

      {admin && (
        <section className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
          <h2 className="font-heading text-2xl font-bold">Personas de la institución</h2>
          <ul className="divide-y rounded-[16px] border">
            {(members as { profile_id: string; display_name: string; role: string }[] | null ?? []).map((m) => (
              <li key={m.profile_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>{m.display_name}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{m.role === "admin" ? "Administración" : "Docente"}</span>
              </li>
            ))}
          </ul>
          <MemberForm institutionId={inst.id} />
        </section>
      )}
    </div>
  );
}
