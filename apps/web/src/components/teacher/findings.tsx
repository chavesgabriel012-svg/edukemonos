"use client";

import type { Finding } from "@edukemonos/curriculum";
import { AlertTriangle, CircleCheck, Info, Sparkles, TriangleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { teacherSummary } from "@/app/docente/actions";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";
import type { StoredSummary } from "@/lib/teacher-summary";

const TONE = {
  alerta: { icon: TriangleAlert, label: "Conviene atender", cls: "bg-[#FDECE6] text-[#8A2E12]" },
  atencion: { icon: AlertTriangle, label: "Para tener en cuenta", cls: "bg-[#FBF1D9] text-[#6B4A00]" },
  positivo: { icon: CircleCheck, label: "Va bien", cls: "bg-[#E2F6EA] text-[#14532D]" },
  info: { icon: Info, label: "Dato útil", cls: "bg-secondary text-foreground" },
} as const;

/**
 * Findings computed from the section's numbers, each with "¿Cómo se calculó?", plus the AI-written
 * summary and one suggestion per finding. The AI only words things; the numbers come from code.
 */
export function Findings({ target, findings, initial }: { target: string; findings: Finding[]; initial: StoredSummary | null }) {
  const [stored, setStored] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const tips = new Map(stored?.summary.acciones.map((a) => [a.id, a.sugerencia]));

  const generate = () =>
    start(async () => {
      setError(null);
      const r = await teacherSummary(target);
      if (r.ok) setStored(r.stored);
      else setError(r.error);
    });

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] bg-tinta p-5 text-papel sm:p-6">
        <div className="flex items-start gap-4">
          <Kemo size={44} mood={pending ? "think" : "normal"} background={brand.lima} className="shrink-0" />
          <div className="min-w-0 flex-1 space-y-3">
            <h3 className="font-heading text-xl font-bold">Resumen para el docente</h3>
            {stored ? (
              <>
                <p className="leading-relaxed">{stored.summary.resumen}</p>
                <p className="text-xs text-papel/70">
                  Escrito con IA a partir de los números de abajo (sin nombres ni conversaciones) ·{" "}
                  {new Date(stored.createdAt).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </>
            ) : (
              <>
                <p className="text-papel/85">
                  La IA lee los hallazgos de esta sección (solo números y temas, nunca nombres ni lo que escriben al tutor)
                  y propone qué hacer en clase.
                </p>
                <button onClick={generate} disabled={pending || !findings.length}
                  className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-lima px-4 font-semibold text-tinta transition hover:bg-[#b5e51f] disabled:opacity-60">
                  <Sparkles aria-hidden className="size-4" />
                  {pending ? "Escribiendo el resumen…" : "Generar resumen con IA"}
                </button>
              </>
            )}
            {error && <p role="alert" className="text-sm text-[#FFD5C7]">{error}</p>}
          </div>
        </div>
      </div>

      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cuando los estudiantes empiecen a practicar, aquí aparecerán los hallazgos de la sección.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {findings.map((f) => {
            const t = TONE[f.tone];
            return (
              <li key={f.id} className="flex flex-col gap-2.5 rounded-[22px] border bg-card p-5">
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${t.cls}`}>
                  <t.icon aria-hidden className="size-3.5" />
                  {t.label}
                </span>
                <h4 className="font-heading text-lg leading-snug font-bold">{f.title}</h4>
                <p className="text-sm text-muted-foreground">{f.detail}</p>
                {tips.get(f.id) && (
                  <p className="flex gap-2 rounded-[14px] bg-secondary p-3 text-sm">
                    <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-violeta" />
                    <span><span className="font-medium">Sugerencia: </span>{tips.get(f.id)}</span>
                  </p>
                )}
                <details className="group mt-auto text-sm">
                  <summary className="cursor-pointer font-medium text-violeta underline-offset-2 hover:underline">¿Cómo se calculó?</summary>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{f.evidence}</p>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
