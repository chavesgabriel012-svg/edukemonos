import { BookOpenCheck, CalendarDays, Gamepad2, Grid3x3, MessageCircleQuestion, Smartphone, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AudienceHero, ClosingBand, Feature, SafetyGrid, Steps } from "@/components/landing/blocks";
import { Section, SectionHeading, Tick } from "@/components/landing/section";
import { action } from "@/components/ui/action";

export const metadata: Metadata = {
  title: "Para colegios",
  description: "Eduka para colegios privados: una plataforma de estudio con IA creada con el contenido de su institución.",
};

export default function SchoolsPage() {
  return (
    <>
      <AudienceHero title="Para colegios privados" lead="Eduka se crea con el contenido de su colegio. Es 100 % personalizado." mood="wow">
        <Link href="/docente/demo" className={action({ variant: "lima-on-dark" })}>Ver el panel de demostración</Link>
      </AudienceHero>

      <Section labelledBy="medida-t" tone="card">
        <SectionHeading id="medida-t" title="Hecho con su contenido" lead="No es un catálogo genérico. Parte de los programas y materiales de su institución." />
        <ul className="mt-8 max-w-2xl space-y-3 text-lg">
          <Tick>Los temas siguen el orden y los nombres que usa su colegio.</Tick>
          <Tick>El material de estudio, los ejercicios y los juegos se generan a partir de ese contenido.</Tick>
          <Tick>Cada ejercicio se verifica antes de publicarse, y sus docentes pueden revisarlo y corregirlo.</Tick>
          <Tick>El tutor se apoya en el material de su colegio para guiar a cada estudiante.</Tick>
        </ul>
      </Section>

      <Section labelledBy="recibe-t">
        <SectionHeading id="recibe-t" title="Qué recibe el colegio" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={Target} title="Diagnóstico">Una prueba adaptativa por materia que ubica a cada estudiante y le sugiere una ruta.</Feature>
          <Feature icon={BookOpenCheck} title="Estudio y práctica">Material por tema y ejercicios que explican cada respuesta.</Feature>
          <Feature icon={MessageCircleQuestion} title="Tutor con IA">Kemo guía con pistas, sin dar la respuesta ni hacer la tarea.</Feature>
          <Feature icon={Gamepad2} title="Juegos y racha">Minijuegos y una racha semanal que premian el dominio, no el tiempo en pantalla.</Feature>
          <Feature icon={Grid3x3} title="Panel por docente">Dominio por tema, actividad semanal y quién podría necesitar apoyo.</Feature>
          <Feature icon={Users} title="Grupos y guías">Un código por grupo. Cada docente ve su materia; el docente guía, todas.</Feature>
          <Feature icon={CalendarDays} title="Calendario propio">Los periodos y las vacaciones de su institución, no un calendario ajeno.</Feature>
          <Feature icon={Smartphone} title="Sin instalar nada">Funciona en cualquier celular o computadora con navegador.</Feature>
        </ul>
      </Section>

      <Section labelledBy="marcha-t" tone="card">
        <SectionHeading id="marcha-t" title="Cómo sería la puesta en marcha" />
        <Steps items={[
          { title: "Su contenido", text: "El colegio comparte sus programas y materiales por nivel y materia." },
          { title: "Generación", text: "Se crean el material, los ejercicios y los juegos, y se verifican." },
          { title: "Revisión", text: "Sus docentes revisan y ajustan antes de que llegue a estudiantes." },
          { title: "Grupos", text: "Cada grupo recibe un código y cada docente, su panel." },
        ]} />
      </Section>

      <Section tone="tinta" labelledBy="seguridad-t">
        <SectionHeading id="seguridad-t" onDark title="Hecho para menores de edad" lead="Datos mínimos, consentimiento al unirse a un grupo y registro de cada acceso docente." />
        <SafetyGrid />
      </Section>

      <Section labelledBy="licencia-t">
        <SectionHeading id="licencia-t" title="Licencia" lead="Una licencia anual por institución." />
        <ul className="mt-8 max-w-2xl space-y-3 text-lg">
          <Tick>Cubre la creación del contenido de su colegio y el uso de la plataforma.</Tick>
          <Tick>La capacitación a docentes es opcional.</Tick>
          <Tick>Eduka está en fase de prueba: buscamos los primeros colegios piloto.</Tick>
        </ul>
        <p className="mt-8 max-w-2xl text-muted-foreground">
          Para colegios públicos, el acceso se negociaría con el Ministerio de Educación Pública.
        </p>
      </Section>

      <ClosingBand title="Véalo funcionando" text="La demostración usa Matemáticas y Español de 7.º a 9.º con los programas del MEP." href="/estudiar" label="Probar como estudiante" />
    </>
  );
}
