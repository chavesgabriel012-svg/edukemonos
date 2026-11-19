import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { PrintButton } from "@/components/admin/print-button";
import { requireAdmin } from "@/lib/staff";
import { adminClient } from "@/lib/supabase/admin";
import { formatCode } from "@/lib/teacher";

export const metadata: Metadata = { title: "Hoja de códigos" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One card per group with its code, to hand out on the first day. No student names. */
export default async function CodesPage({ params }: PageProps<"/admin/colegios/[id]/codigos">) {
  const { id } = await params;
  await requireAdmin();
  if (!UUID.test(id)) notFound();
  const { data: inst } = await adminClient().from("institutions").select("name").eq("id", id).maybeSingle();
  if (!inst) notFound();
  // Groups have no student data; read with the service client after the admin check above.
  const { data: groups } = await adminClient().from("groups").select("id, name, grade_id, join_code").eq("institution_id", id).eq("active", true).order("grade_id").order("name");

  return (
    <div className="space-y-6">
      <div className="space-y-2 print:hidden">
        <BackLink href={`/admin/colegios/${id}?tab=grupos`}>{inst.name}</BackLink>
        <h1 className="font-heading text-3xl font-bold">Hoja de códigos</h1>
        <PrintButton />
      </div>
      {!groups?.length ? <p className="text-sm text-muted-foreground">El colegio todavía no tiene grupos.</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
          {groups.map((g) => (
            <li key={g.id} className="break-inside-avoid space-y-2 rounded-[22px] border-2 border-tinta p-6 print:rounded-none">
              <p className="text-sm text-muted-foreground">{inst.name} · {g.grade_id}.º</p>
              <h2 className="font-heading text-2xl font-bold">{g.name}</h2>
              <p className="font-mono text-5xl font-bold tracking-[0.12em]" aria-label={`Código ${formatCode(g.join_code).split("").join(" ")}`}>{formatCode(g.join_code)}</p>
              <p className="text-sm">Entra a eduka y toca &quot;Únete a tu sección&quot;</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
