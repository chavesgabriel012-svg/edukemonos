import { normalizeCertificateCode } from "@edukemonos/curriculum";
import { BadgeCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { action } from "@/components/ui/action";
import { card } from "@/components/ui/styles";
import { longDate, verifyCertificate } from "@/lib/badges";

export const metadata: Metadata = { title: "Verificar un certificado" };

export default async function VerifyCodePage({ params }: PageProps<"/verificar/[codigo]">) {
  const code = normalizeCertificateCode(decodeURIComponent((await params).codigo)).slice(0, 20);
  const r = await verifyCertificate(code);
  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="font-heading text-4xl leading-none font-bold">Verificar un certificado</h1>
      {r.valid ? (
        <div role="status" className={`${card} space-y-4`}>
          <p className="flex items-center gap-2 font-heading text-2xl font-bold text-emerald-800">
            <BadgeCheck aria-hidden strokeWidth={2.5} className="size-7" />
            Certificado válido
          </p>
          <dl className="space-y-2">
            <div><dt className="text-sm text-muted-foreground">Tema</dt><dd className="font-semibold">{r.unit}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Materia y año</dt><dd>{r.subject} · {r.grade}.º</dd></div>
            <div><dt className="text-sm text-muted-foreground">Logrado el</dt><dd>{r.earned_on ? longDate(r.earned_on) : ""}</dd></div>
          </dl>
          <div>
            <p className="text-sm text-muted-foreground">Habilidades</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{(r.skills ?? []).map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Código {code}. Eduka no guarda el nombre que aparece en el certificado. Eduka es una iniciativa independiente; el certificado no tiene
            valor oficial del MEP.
          </p>
        </div>
      ) : (
        <div role="alert" className={`${card} space-y-4`}>
          <p className="flex items-center gap-2 font-heading text-2xl font-bold text-destructive">
            <CircleX aria-hidden strokeWidth={2.5} className="size-7" />
            No encontramos ese código
          </p>
          <p className="text-sm text-muted-foreground">Revise que esté escrito igual que en el certificado: diez letras y números, como 7F3A2-9C01B.</p>
          <Link href="/verificar" className={action({ size: "md" })}>Probar otro código</Link>
        </div>
      )}
    </section>
  );
}
