import { BookOpenCheck, MessageCircleQuestion, Target } from "lucide-react";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";
import { GRADE_LABEL, GRADES } from "@/lib/learn";

const STEPS = [
  { icon: Target, title: "Haz el diagnóstico", text: "10 preguntas que se adaptan a ti y te dicen por dónde empezar." },
  { icon: BookOpenCheck, title: "Aprende y practica", text: "Material alineado a los programas del MEP y ejercicios con explicación." },
  { icon: MessageCircleQuestion, title: "Pregúntale a Kemo", text: "El tutor te guía paso a paso, con pistas antes que respuestas." },
] as const;

export default function HomePage() {
  return (
    <section className="space-y-10">
      <div className="relative overflow-hidden rounded-[28px] bg-violeta px-6 py-8 text-white sm:px-10 sm:py-12">
        <div className="relative z-10 max-w-xl space-y-4">
          <h1 className="font-heading text-[2.6rem] leading-[0.95] font-bold tracking-tight sm:text-6xl">
            Estudia a tu ritmo.
            <span className="block whitespace-nowrap text-lima">De 7.º a 9.º</span>
          </h1>
          <p className="text-lg text-white/85">
            Gratis, con los programas del MEP: material, ejercicios con explicación y un tutor que te guía sin darte la
            respuesta.
          </p>
          <Link href="#grado"
            className="inline-flex h-[52px] items-center rounded-[14px] bg-lima px-6 font-semibold text-tinta transition hover:bg-[#b5e51f] focus-visible:outline-2 focus-visible:outline-white">
            Empezar
          </Link>
        </div>
        <Kemo size={168} mood="normal" background={brand.lima}
          className="pointer-events-none absolute -right-8 -bottom-10 rotate-[-8deg] opacity-95 sm:right-10 sm:bottom-8 sm:size-[200px]" />
      </div>

      <div id="grado" className="scroll-mt-6 space-y-3">
        <h2 className="font-heading text-2xl font-bold">¿En qué año estás?</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {GRADES.map((g) => (
            <li key={g}>
              <Link href={`/estudiar/${g}`}
                className="group flex h-full items-center justify-between rounded-[22px] border bg-card p-5 transition hover:border-violeta hover:shadow-[0_12px_32px_-12px_rgba(23,19,42,0.18)] focus-visible:outline-2">
                <span className="flex flex-col">
                  <span className="font-heading text-4xl leading-none font-bold text-violeta">{g}.º</span>
                  <span className="mt-1 text-lg">{GRADE_LABEL[g]} año</span>
                </span>
                <span aria-hidden className="text-2xl text-muted-foreground transition group-hover:translate-x-1 group-hover:text-violeta">→</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          No necesitas cuenta: tu avance se guarda en este dispositivo. ¿Tu docente te dio un código?{" "}
          <Link href="/unirme" className="font-medium underline underline-offset-2">Únete a tu sección</Link>.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-2xl font-bold">¿Cómo funciona?</h2>
          <Link href="/como-funciona" className="text-sm font-medium underline underline-offset-2">Ver todas las preguntas</Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="space-y-2 rounded-[22px] bg-card p-5">
              <span className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-lima text-tinta">
                  <Icon aria-hidden strokeWidth={2.5} className="size-5" />
                </span>
                <span className="font-mono text-xs text-muted-foreground">PASO {i + 1}</span>
              </span>
              <h3 className="font-heading text-xl font-bold">{title}</h3>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
