import { ArrowRight, BookOpenCheck, ClipboardCheck, MessageCircleQuestion, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { ClosingBand, SafetyGrid } from "@/components/landing/blocks";
import { ChatPreview, HeatmapPreview } from "@/components/landing/previews";
import { Section, SectionHeading, Tick } from "@/components/landing/section";
import { SHELL } from "@/components/site/page-shell";
import { action } from "@/components/ui/action";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";
import { contentStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: { absolute: "Eduka: un tutor que te guía, sin darte la respuesta" },
  description: site.description,
};

/** The published counts are read from the database at most once an hour. */
export const revalidate = 3600;

const GRADES = [
  { grade: 7, label: "Sétimo" },
  { grade: 8, label: "Octavo" },
  { grade: 9, label: "Noveno" },
] as const;

/** SPEC, anexo B. Checked again against the PISA 2025 results and the Estado de la Educación 2025 report on 2026-11-11. */
const CHALLENGE = [
  { figure: "30 %", text: "alcanza el nivel básico en matemáticas a los 15 años. En la OCDE, el 65 %.", source: "PISA 2025" },
  { figure: "53 %", text: "alcanza el nivel básico en lectura. En la OCDE, el 69 %.", source: "PISA 2025" },
  { figure: "4 años", text: "de vacío en lectura y matemáticas entre los 15 y los 16 años.", source: "Estado de la Educación 2025" },
] as const;

const STEPS = [
  { icon: Target, title: "Diagnóstico", text: "10 preguntas que te dicen por dónde empezar." },
  { icon: BookOpenCheck, title: "Aprender", text: "Resumen, explicación y ejemplos de cada tema." },
  { icon: ClipboardCheck, title: "Practicar", text: "Ejercicios que explican cada respuesta." },
  { icon: MessageCircleQuestion, title: "Preguntar a Kemo", text: "Pistas cuando algo no te queda claro." },
] as const;

const number = new Intl.NumberFormat("es-CR");

export default async function LandingPage() {
  const stats = await contentStats();
  const numbers = [
    { value: number.format(stats.units), label: "temas del programa oficial" },
    { value: number.format(stats.exercises), label: "ejercicios verificados" },
    { value: number.format(stats.materials), label: "materiales de estudio" },
  ];

  return (
    <>
      <section className="bg-violeta text-white">
        <div className={`${SHELL} grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-20`}>
          <div className="space-y-6">
            <h1 className="font-heading text-[2.75rem] leading-[0.95] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Un tutor que te guía,
              <span className="block text-lima">sin darte la respuesta.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-white/85">
              Estudio con IA para secundaria en Costa Rica, con los programas del MEP. Está en fase de prueba: hoy
              puedes probarlo con Matemáticas y Español de 7.º a 9.º.
            </p>
            <div className="space-y-3">
              <p id="grado" className="font-medium">Pruébalo en un año:</p>
              <ul aria-labelledby="grado" className="grid max-w-md grid-cols-3 gap-2 sm:flex sm:max-w-none sm:flex-wrap sm:gap-3">
                {GRADES.map(({ grade, label }) => (
                  <li key={grade}>
                    <Link href={`/estudiar/${grade}`}
                      className="group flex min-h-[64px] flex-col items-start justify-center gap-1 rounded-[16px] bg-lima px-4 py-3 text-tinta transition hover:-translate-y-0.5 hover:bg-[#b5e51f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:flex-row sm:items-center sm:gap-3 sm:py-2">
                      <span className="font-heading text-3xl leading-none font-bold">{grade}.º</span>
                      <span className="text-sm leading-tight font-medium">{label}</span>
                      <ArrowRight aria-hidden strokeWidth={2.5} className="hidden size-4 transition group-hover:translate-x-0.5 sm:block" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-white/80">No pide cuenta ni correo.</p>
            </div>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <Kemo size={112} background={brand.lima} className="pointer-events-none absolute -top-16 right-10 hidden rotate-[8deg] lg:block" />
            <div className="relative w-full max-w-md"><ChatPreview /></div>
          </div>
        </div>
      </section>

      <Section id="reto" labelledBy="reto-t">
        <SectionHeading id="reto-t" title="Siete de cada diez estudiantes no alcanzan el nivel básico en matemáticas." />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {CHALLENGE.map((c) => (
            <li key={c.figure} className="flex flex-col gap-2 rounded-[22px] border bg-card p-6">
              <span className="font-heading text-6xl leading-none font-bold text-violeta">{c.figure}</span>
              <p className="leading-relaxed">{c.text}</p>
              <p className="mt-auto pt-2 text-xs text-muted-foreground">{c.source}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed">
          Eduka da práctica diaria con explicación a cada estudiante, y a cada docente los datos para saber qué reforzar.
        </p>
      </Section>

      <Section id="estudiantes" tone="card" labelledBy="como-t">
        <SectionHeading id="como-t" title="Cómo funciona" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="space-y-3 rounded-[22px] bg-background p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-violeta text-white">
                <Icon aria-hidden strokeWidth={2.5} className="size-5" />
              </span>
              <h3 className="font-heading text-2xl leading-tight font-bold">{title}</h3>
              <p className="text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="lima" className="py-10 sm:py-12">
        <p className="mb-6 font-heading text-2xl font-bold">Lo que ya se puede probar</p>
        <dl className="grid gap-x-6 gap-y-8 sm:grid-cols-3">
          {numbers.map((n) => (
            <div key={n.label} className="flex flex-col-reverse gap-1">
              <dt className="font-medium">{n.label}</dt>
              <dd className="font-heading text-6xl leading-none font-bold">{n.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="familias" labelledBy="familias-t">
        <SectionHeading id="familias-t" title="Para familias" lead="Una ayuda para estudiar que no hace la tarea." />
        <ul className="mt-8 max-w-2xl space-y-3 text-lg">
          <Tick>Funciona en el navegador del celular. No hay que instalar nada.</Tick>
          <Tick>Sigue los programas del MEP, los mismos de la clase.</Tick>
          <Tick>Si su hijo o hija pide la respuesta, Kemo le devuelve una pregunta.</Tick>
        </ul>
        <div className="mt-8">
          <Link href="/familias" className={action({ variant: "outline" })}>Más para familias</Link>
        </div>
      </Section>

      <Section id="docentes" tone="card" labelledBy="docentes-t" className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading id="docentes-t" title="Para docentes" lead="Un panel para ver qué necesita cada sección esta semana." />
          <ul className="mt-8 space-y-3 text-lg">
            <Tick>Dominio de cada estudiante en cada tema.</Tick>
            <Tick>Quién podría necesitar apoyo, y por qué.</Tick>
            <Tick>Un resumen que explica cómo se calculó.</Tick>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/docente/demo" className={action()}>Ver el panel de demostración</Link>
            <Link href="/docentes" className={action({ variant: "outline" })}>Más para docentes</Link>
          </div>
        </div>
        <HeatmapPreview />
      </Section>

      <Section id="colegios" labelledBy="colegios-t">
        <SectionHeading id="colegios-t" title="Para colegios privados" lead="Una licencia anual por institución, sin instalar nada." />
        <ul className="mt-8 max-w-2xl space-y-3 text-lg">
          <Tick>Funciona en cualquier celular o computadora con navegador.</Tick>
          <Tick>Eduka se crea con el contenido de su colegio: es 100 % personalizado.</Tick>
          <Tick>Cada docente tendría su sección y un código para su grupo.</Tick>
        </ul>
        <p className="mt-8 max-w-2xl text-muted-foreground">
          Para colegios públicos, el acceso se negociaría con el Ministerio de Educación Pública.
        </p>
        <div className="mt-8">
          <Link href="/colegios" className={action({ variant: "outline" })}>Más para colegios</Link>
        </div>
      </Section>

      <Section id="seguridad" tone="tinta" labelledBy="seguridad-t">
        <SectionHeading id="seguridad-t" onDark title="Hecho para menores de edad" />
        <SafetyGrid />
        <p className="mt-8 text-sm text-papel/70">Kemo no es un servicio de emergencias.</p>
      </Section>

      <ClosingBand title="¿Lo probamos?" text="Buscamos colegios piloto y docentes que revisen el contenido." href="/estudiar" label="Probar como estudiante" />
    </>
  );
}
