import { Calculator, Flag, MessageCircleQuestion, NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AudienceHero, ClosingBand, Feature, Questions, SafetyGrid, Steps } from "@/components/landing/blocks";
import { ChatPreview } from "@/components/landing/previews";
import { Section, SectionHeading } from "@/components/landing/section";
import { action } from "@/components/ui/action";
import { RETENTION_DAYS_CHAT, TUTOR_LIMITS } from "@/lib/tutor-server";

export const metadata: Metadata = {
  title: "Para familias",
  description: "Qué hace su hijo o hija en Eduka, cómo responde el tutor Kemo y qué pasa con sus datos.",
};

export default function FamiliesPage() {
  return (
    <>
      <AudienceHero title="Para familias" lead="Una ayuda para estudiar que no hace la tarea." mood="happy">
        <Link href="/estudiar" className={action({ variant: "lima-on-dark" })}>Probarlo como estudiante</Link>
      </AudienceHero>

      <Section labelledBy="hace-t" tone="card">
        <SectionHeading id="hace-t" title="Qué hace su hijo o hija en Eduka" lead="Cuatro pasos, en el navegador del celular. No hay que instalar nada." />
        <Steps items={[
          { title: "Hace un diagnóstico", text: "10 preguntas, sin nota. Le dice por cuál tema empezar." },
          { title: "Lee el tema", text: "Un resumen, la explicación paso a paso y ejemplos resueltos." },
          { title: "Practica", text: "Un ejercicio a la vez. Si falla, ve por qué su respuesta no era." },
          { title: "Pregunta", text: "Cuando algo no le queda claro, le escribe a Kemo, el tutor." },
        ]} />
      </Section>

      <Section labelledBy="kemo-t" className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading id="kemo-t" title="Cómo responde Kemo" lead="Kemo es una inteligencia artificial. Su trabajo es que su hijo o hija piense, no que copie." />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            <Feature icon={MessageCircleQuestion} title="Pistas, no respuestas">Si le piden el resultado, devuelve una pregunta. Explica completo solo si las pistas no alcanzan.</Feature>
            <Feature icon={NotebookPen} title="No hace tareas">No escribe ensayos ni resuelve la tarea. Ayuda a planearla y a revisarla.</Feature>
            <Feature icon={Calculator} title="Cuentas exactas">En Matemáticas usa una calculadora, no calcula de memoria.</Feature>
            <Feature icon={Flag} title="Puede equivocarse">Cada respuesta tiene un botón para reportar un error.</Feature>
          </ul>
        </div>
        <div className="flex justify-center"><ChatPreview /></div>
      </Section>

      <Section tone="tinta" labelledBy="seguridad-t">
        <SectionHeading id="seguridad-t" onDark title="Hecho para menores de edad" lead="No hay chat con otras personas, ni perfiles, ni publicaciones." />
        <SafetyGrid />
      </Section>

      <Section labelledBy="preguntas-t" tone="card">
        <SectionHeading id="preguntas-t" title="Lo que suelen preguntar las familias" />
        <Questions items={[
          { q: "¿Con quién habla mi hijo o hija?", a: <p>Solo con Kemo, que es un programa. No hay forma de escribirle a otra persona dentro de Eduka.</p> },
          { q: "¿Qué datos se guardan?", a: <p>Las respuestas a los ejercicios y las conversaciones con Kemo, sin los datos personales que se reconocen. Las conversaciones se borran a los {RETENTION_DAYS_CHAT} días.</p> },
          { q: "¿Qué pasa si escribe que se siente mal?", a: <p>Kemo deja el tema escolar, le anima a hablar hoy con una persona adulta de confianza y la aplicación muestra el 911. Kemo no reemplaza a una persona ni da consejo médico.</p> },
          { q: "¿Lo ve su docente?", a: <p>Solo si se une a un grupo con un código, y con su consentimiento. El docente ve el avance y los temas consultados, nunca lo que le escribe a Kemo.</p> },
          { q: "¿Puede pasar horas chateando?", a: <p>No. Hay un máximo de {TUTOR_LIMITS.perDay} mensajes por día y, después de una hora seguida de estudio, la aplicación sugiere un descanso.</p> },
          { q: "¿Cuánto cuesta?", a: <p>Probarlo no cuesta nada: Eduka está en fase de prueba.</p> },
        ]} />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/ia" className={action({ variant: "outline" })}>Más sobre Kemo y la IA</Link>
          <Link href="/privacidad" className={action({ variant: "outline" })}>Aviso de privacidad</Link>
        </div>
      </Section>

      <ClosingBand title="Pruébelo en casa" text="Elija un año y recorra un tema completo." href="/estudiar/7" label="Empezar por sétimo" />
    </>
  );
}
