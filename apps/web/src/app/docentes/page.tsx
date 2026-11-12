import { Download, EyeOff, Flame, Gamepad2, Grid3x3, Lock, PenLine, Sparkles, ToggleRight, Trophy, UserRoundSearch, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AudienceHero, ClosingBand, Feature, Steps } from "@/components/landing/blocks";
import { HeatmapPreview } from "@/components/landing/previews";
import { Section, SectionHeading, Tick } from "@/components/landing/section";
import { action } from "@/components/ui/action";

export const metadata: Metadata = {
  title: "Para docentes",
  description: "El panel docente de Eduka: dominio por tema, quién podría necesitar apoyo y un resumen que explica cómo se calculó.",
};

export default function TeachersPage() {
  return (
    <>
      <AudienceHero title="Para docentes" lead="Un panel para ver qué necesita cada sección esta semana, sin preparar nada." mood="think">
        <Link href="/docente/demo" className={action({ variant: "lima-on-dark" })}>Ver el panel de demostración</Link>
      </AudienceHero>

      <Section labelledBy="panel-t" tone="card" className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading id="panel-t" title="Lo que muestra el panel" lead="Se calcula con las respuestas de sus estudiantes a los ejercicios, sobre los temas del programa." />
          <ul className="mt-8 space-y-3 text-lg">
            <Tick>Dominio de cada estudiante en cada tema.</Tick>
            <Tick>Actividad de la semana y porcentaje de aciertos.</Tick>
            <Tick>Nivel del diagnóstico por materia.</Tick>
          </ul>
        </div>
        <HeatmapPreview />
      </Section>

      <Section labelledBy="decidir-t">
        <SectionHeading id="decidir-t" title="Para decidir qué hacer en clase" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={Grid3x3} title="Mapa de calor">Estudiantes en las filas, temas en las columnas. Los vacíos del grupo se ven de un vistazo.</Feature>
          <Feature icon={UserRoundSearch} title="Quién podría necesitar apoyo">Dominio menor a 50 % o sin actividad en la semana, con la razón a la vista. Es una señal para conversar, no una etiqueta.</Feature>
          <Feature icon={Sparkles} title="Resumen con IA">Propone qué reforzar y muestra «¿Cómo se calculó?» con los números de cada hallazgo.</Feature>
          <Feature icon={PenLine} title="Errores de escritura">Cuántos hubo de cada tipo: tildes, puntuación, concordancia. El texto del estudiante no se guarda.</Feature>
          <Feature icon={Users} title="Detalle por estudiante">Temas, intentos, diagnóstico y una línea de tiempo de su actividad.</Feature>
          <Feature icon={Download} title="Descarga en CSV">Una fila por estudiante, para su propia hoja de cálculo.</Feature>
        </ul>
      </Section>

      <Section labelledBy="grupo-t" tone="card">
        <SectionHeading id="grupo-t" title="Cómo entraría su grupo" lead="Un solo código por grupo. Cada docente ve su materia." />
        <Steps items={[
          { title: "Se crea el grupo", text: "Por ejemplo, 7-3, con las materias que lleva." },
          { title: "Se dicta el código", text: "El mismo para todas las materias del grupo." },
          { title: "Cada estudiante se une", text: "Escribe su nombre y acepta que sus docentes vean su avance." },
          { title: "Usted ve su materia", text: "El docente guía, si lo hay, ve todas las del grupo." },
        ]} />
      </Section>

      <Section labelledBy="motivacion-t">
        <SectionHeading id="motivacion-t" title="Motivación sin presión" lead="Todo premia ejercicios bien resueltos. Nunca clics, tiempo en pantalla ni velocidad." />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={Flame} title="Racha semanal">Cuenta las semanas con cinco ejercicios bien resueltos. Las vacaciones no la rompen.</Feature>
          <Feature icon={Trophy} title="Meta del grupo">Una meta colectiva por semana y una tabla con apodos, sin último lugar.</Feature>
          <Feature icon={Gamepad2} title="Minijuegos">Parejas, ordenar pasos, completar y encontrar el error, con contenido verificado.</Feature>
          <Feature icon={ToggleRight} title="Usted decide">Todo funciona solo. Lo único que hace el docente es apagar lo que no quiera usar.</Feature>
        </ul>
      </Section>

      <Section tone="tinta" labelledBy="privacidad-t">
        <SectionHeading id="privacidad-t" onDark title="Lo que el panel no muestra" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: EyeOff, title: "Las conversaciones", text: "Usted ve en qué temas consultaron al tutor, nunca lo que escribieron." },
            { icon: Lock, title: "Otras secciones", text: "Solo las suyas. Cada vez que abre el panel queda registrado." },
            { icon: Users, title: "Nombres a la IA", text: "El resumen con IA recibe conteos y títulos de temas, sin nombres." },
          ].map(({ icon: Icon, title, text }) => (
            <li key={title} className="space-y-2 rounded-[22px] bg-white/8 p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-lima text-tinta"><Icon aria-hidden strokeWidth={2.5} className="size-5" /></span>
              <h3 className="font-heading text-xl leading-tight font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-papel/75">{text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="contenido-t" tone="card">
        <SectionHeading id="contenido-t" title="Sobre el contenido" lead="Hoy está generado con IA y verificado automáticamente. Falta la revisión de docentes." />
        <ul className="mt-8 max-w-2xl space-y-3 text-lg">
          <Tick>Cada ejercicio lo resuelve una segunda IA sin ver la respuesta. Si no coincide, no se publica.</Tick>
          <Tick>En Matemáticas, el resultado se recalcula con una calculadora exacta.</Tick>
          <Tick>Lo que no revisó una persona lleva la etiqueta «pendiente de revisión».</Tick>
          <Tick>Buscamos docentes de Matemáticas y Español que quieran revisarlo.</Tick>
        </ul>
      </Section>

      <ClosingBand title="Véalo con datos" text="Una sección de 26 estudiantes ficticios sobre los temas de sétimo." href="/docente/demo" label="Abrir la demostración" />
    </>
  );
}
