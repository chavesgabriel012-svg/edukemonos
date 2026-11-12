"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { logCertificateDownload } from "@/app/(app)/estudiar/actions";
import { Logo } from "@/components/brand/logo";
import { action } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

export interface CertificateData {
  unitId: string;
  unit: string;
  subject: string;
  grade: number;
  skills: string[];
  earnedOn: string;
  code: string;
  verifyUrl: string;
}

/**
 * A printable certificate of a mastered unit. The name is typed here and stays in this browser:
 * it is never sent to Eduka or to the AI. Printing (or saving as PDF) logs only the unit.
 */
export function Certificate({ data }: { data: CertificateData }) {
  const [name, setName] = useState("");

  function print() {
    void logCertificateDownload(data.unitId);
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-[22px] border bg-card p-5 print:hidden">
        <label className="block space-y-1.5">
          <span className="font-semibold">Tu nombre en el certificado</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className={field} />
          <span className="block text-xs text-muted-foreground">Solo queda en este dispositivo: Eduka no lo guarda ni lo envía a ningún lado.</span>
        </label>
        <button type="button" onClick={print} className={action()}>
          <Printer aria-hidden strokeWidth={2.5} className="size-5" />
          Imprimir o guardar como PDF
        </button>
      </div>

      <article className="mx-auto max-w-3xl space-y-6 rounded-[28px] border-[6px] border-violeta bg-white p-8 text-tinta sm:p-12 print:max-w-none print:rounded-none print:border-[10px]">
        <div className="flex items-center justify-between gap-4">
          <Logo size={34} />
          <span className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Certificado de dominio</span>
        </div>
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">Eduka certifica que</p>
          <p className="min-h-12 border-b-2 border-dashed border-tinta/30 pb-1 font-heading text-4xl font-bold">{name.trim() || " "}</p>
          <p className="text-muted-foreground">dominó el tema</p>
          <h1 className="font-heading text-3xl leading-tight font-bold text-violeta sm:text-4xl">{data.unit}</h1>
          <p className="font-mono text-sm tracking-wide uppercase">{data.subject} · {data.grade}.º año</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Con estas habilidades, cada una con un dominio estimado de al menos 70 %:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {data.skills.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4 text-sm">
          <span>Logrado el {data.earnedOn}</span>
          <span className="text-right">
            Código de verificación: <span className="font-mono font-semibold">{data.code}</span>
            <span className="block text-xs text-muted-foreground">{data.verifyUrl}</span>
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          El dominio lo estima Eduka con las respuestas a ejercicios de los programas del MEP. Eduka es una iniciativa independiente y no es
          una plataforma oficial del Ministerio de Educación Pública: este certificado no tiene valor oficial.
        </p>
      </article>
    </div>
  );
}
