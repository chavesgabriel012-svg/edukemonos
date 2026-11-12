import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { longDate, myBadges, verifyCertificate } from "@/lib/badges";
import { requestOrigin } from "@/lib/origin";
import { Certificate } from "./certificate";

export const metadata: Metadata = { title: "Certificado de dominio" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the student who mastered the unit can open its certificate. */
export default async function CertificatePage({ params }: PageProps<"/certificado/[unidad]">) {
  const { unidad } = await params;
  if (!UUID.test(unidad)) notFound();
  const mine = await myBadges();
  const badge = mine?.badges.find((b) => b.badge === "unit_mastered" && b.ref_id === unidad);
  if (!badge?.code) notFound();
  const verified = await verifyCertificate(badge.code);
  if (!verified.valid) notFound();
  const origin = requestOrigin(await headers());
  return (
    <section className="space-y-6">
      <div className="print:hidden">
        <BackLink href="/insignias">Mis insignias</BackLink>
      </div>
      <Certificate data={{
        unitId: unidad,
        unit: verified.unit ?? "",
        subject: verified.subject ?? "",
        grade: verified.grade ?? 0,
        skills: verified.skills ?? [],
        earnedOn: longDate(verified.earned_on ?? badge.earned_at),
        code: badge.code,
        verifyUrl: `${origin.replace(/^https?:\/\//, "")}/verificar/${badge.code}`,
      }} />
    </section>
  );
}
