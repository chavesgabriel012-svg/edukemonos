import { ArrowRight, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { action } from "@/components/ui/action";
import { brand } from "@/lib/brand";
import { GRADE_LABEL, GRADES } from "@/lib/learn";

export const metadata: Metadata = {
  title: "Elige tu año",
  description: "Elige sétimo, octavo o noveno y empieza a estudiar. Sin cuenta: tu avance se guarda en este dispositivo.",
};

/** The students' way in: pick a grade. Also the start page of the installed app. */
export default function StudyHomePage() {
  return (
    <section className="space-y-8">
      <div className="relative overflow-hidden rounded-[28px] bg-violeta px-6 py-8 text-white sm:px-10 sm:py-10">
        <div className="relative z-10 max-w-xl space-y-3">
          <h1 className="font-heading text-[2.5rem] leading-[0.95] font-bold tracking-tight sm:text-6xl">
            ¿En qué año
            <span className="block text-lima">estás?</span>
          </h1>
          <p className="text-lg text-white/85">Elige tu año y luego la materia. No necesitas cuenta: tu avance se guarda en este dispositivo.</p>
        </div>
        <Kemo size={168} mood="normal" background={brand.lima}
          className="pointer-events-none absolute -right-6 -bottom-10 size-[112px] rotate-[-8deg] opacity-95 sm:right-10 sm:bottom-6 sm:size-[168px]" />
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {GRADES.map((g) => (
          <li key={g}>
            <Link href={`/estudiar/${g}`}
              className="group flex h-full items-center justify-between rounded-[22px] border bg-card p-6 transition hover:-translate-y-0.5 hover:border-violeta hover:shadow-[0_12px_32px_-12px_rgba(23,19,42,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2">
              <span className="flex flex-col">
                <span className="font-heading text-6xl leading-none font-bold text-violeta">{g}.º</span>
                <span className="mt-1 text-lg">{GRADE_LABEL[g]} año</span>
              </span>
              <ArrowRight aria-hidden strokeWidth={2.5} className="size-6 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-violeta" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-start gap-4 rounded-[22px] bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lima text-tinta">
            <KeyRound aria-hidden strokeWidth={2.5} className="size-5" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-bold">¿Tu docente te dio un código?</h2>
            <p className="text-sm text-muted-foreground">Únete a tu sección para que tu docente vea tu avance y te ayude mejor.</p>
          </div>
        </div>
        <Link href="/unirme" className={action({ variant: "outline", size: "md" })}>Unirme a mi sección</Link>
      </div>

      <p className="text-sm text-muted-foreground">
        ¿Primera vez aquí? <Link href="/como-funciona" className="font-medium underline underline-offset-2">Mira cómo funciona</Link>.{" "}
        ¿Cambiaste de celular? <Link href="/mi-codigo" className="font-medium underline underline-offset-2">Recupera tu progreso con tu código</Link>.
      </p>
    </section>
  );
}
