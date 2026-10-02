import type { Metadata } from "next";
import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { Faq, type FaqItem } from "@/components/site/faq";
import { brand } from "@/lib/brand";
import { RETENTION_DAYS_CHAT, TUTOR_LIMITS } from "@/lib/tutor-server";

export const metadata: Metadata = {
  title: "Kemo y la IA",
  description: "Quién es Kemo, qué hace la inteligencia artificial en Eduka, qué datos ve y qué se guarda.",
};

function items(): FaqItem[] {
  return [
    {
      id: "kemo",
      q: "¿Quién es Kemo?",
      a: (
        <>
          <p>
            Kemo es el tutor de Eduka: una inteligencia artificial que te acompaña en cada tema, en la pestaña{" "}
            <strong>Preguntar a Kemo</strong>. Conoce el tema que estás estudiando, el material publicado y cómo te ha ido
            en los ejercicios, para ayudarte justo donde te cuesta.
          </p>
          <p>Kemo no es una persona ni un docente. Es una herramienta para practicar y entender mejor.</p>
        </>
      ),
    },
    {
      id: "respuesta",
      q: "¿Por qué Kemo no me da la respuesta de una vez?",
      a: (
        <>
          <p>
            Porque se aprende más cuando llegas tú. Kemo primero te pregunta qué entiendes o qué intentaste, luego te da
            pistas, cada vez más concretas. Si después de las pistas sigues sin poder, o le pides la explicación completa,
            te la da paso a paso y termina con una pregunta para comprobar que quedó claro.
          </p>
          <p>Tampoco hace tareas ni ensayos por ti, pero te ayuda a planearlos y a revisarlos.</p>
        </>
      ),
    },
    {
      id: "ayuda",
      q: "¿En qué me puede ayudar?",
      a: (
        <ul>
          <li>Dudas del tema que estás estudiando, o de otros temas de la misma materia.</li>
          <li>Revisar un texto tuyo: ortografía, puntuación, concordancia y cohesión.</li>
          <li>Darte ejercicios para practicar y revisar tu procedimiento.</li>
          <li>En comprensión lectora, guiarte para encontrar pistas en el texto, deducir y opinar con fundamento.</li>
        </ul>
      ),
    },
    {
      id: "errores",
      q: "¿Kemo puede equivocarse?",
      a: (
        <>
          <p>
            Sí. Como toda inteligencia artificial, a veces se equivoca. Para reducirlo, en Matemáticas Kemo usa una
            calculadora exacta en vez de calcular de memoria, se apoya en el material del tema y probamos su forma de
            responder con decenas de casos antes de cada cambio.
          </p>
          <p>
            Si algo no te cuadra, pregúntale a tu docente y toca <strong>Reportar un error</strong> debajo de la respuesta.
          </p>
        </>
      ),
    },
    {
      id: "donde",
      q: "¿Dónde más se usa inteligencia artificial en Eduka?",
      a: (
        <ul>
          <li>Para redactar el material y los ejercicios a partir de los programas del MEP. Cada ejercicio se revisa automáticamente antes de publicarse.</li>
          <li>Para darte retroalimentación en las tareas de escritura de Español.</li>
          <li>Para Kemo, el tutor.</li>
        </ul>
      ),
    },
    {
      id: "modelo",
      q: "¿Qué inteligencia artificial usa?",
      a: (
        <p>
          Modelos Claude, de la empresa Anthropic. Eduka les envía solo lo necesario para responderte, sin tu nombre.
        </p>
      ),
    },
    {
      id: "datos",
      q: "¿Qué datos ve la IA?",
      a: (
        <>
          <p>
            El mensaje que escribes, el tema que estudias y una estimación de cuánto dominas ese tema.{" "}
            <strong>Nunca tu nombre.</strong>
          </p>
          <p>
            Antes de enviar tu mensaje, Eduka quita datos personales que reconozca, como nombres, cédulas, teléfonos,
            correos, direcciones o el nombre de tu colegio, y los cambia por «[dato personal omitido]». Igual, lo mejor es
            no escribirlos.
          </p>
        </>
      ),
    },
    {
      id: "guarda",
      q: "¿Qué se guarda de mis conversaciones?",
      a: (
        <>
          <p>
            Las conversaciones con Kemo se guardan, ya sin esos datos personales, para que puedas seguirlas después y
            para revisar los errores que se reporten. Se borran automáticamente a los {RETENTION_DAYS_CHAT} días.
          </p>
          <p>
            Si te uniste a una sección, tu docente podrá ver cuántas veces usaste a Kemo y en qué temas, pero{" "}
            <strong>no lee lo que escribes</strong>. De las tareas de escritura solo se guarda cuántos errores hubo de
            cada tipo, no tu texto.
          </p>
        </>
      ),
    },
    {
      id: "mal",
      q: "¿Qué pasa si le cuento a Kemo que me siento mal?",
      a: (
        <>
          <p>
            Kemo te responde con calidez, te anima a hablar hoy con una persona adulta de confianza (alguien de tu familia,
            tu docente o la persona orientadora del colegio) y Eduka te muestra recursos de ayuda. Si estás en peligro o
            alguien corre peligro, llama al <strong>911</strong>.
          </p>
          <p>Kemo no reemplaza a una persona: no es un servicio de ayuda psicológica ni de emergencias.</p>
        </>
      ),
    },
    {
      id: "limites",
      q: "¿Hay un límite de mensajes?",
      a: (
        <p>
          Sí: hasta {TUTOR_LIMITS.perSession} mensajes por conversación y {TUTOR_LIMITS.perDay} por día. Cada respuesta de
          la IA tiene un costo, y los límites ayudan a que Eduka siga siendo gratis y alcance para todos.
        </p>
      ),
    },
  ];
}

export default function AiPage() {
  return (
    <article className="space-y-8">
      <header className="flex items-center gap-5 rounded-[28px] bg-tinta p-6 text-papel sm:p-8">
        <Kemo size={72} mood="think" background={brand.lima} className="hidden sm:block" />
        <div className="space-y-2">
          <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Kemo y la IA</h1>
          <p className="text-papel/80">Cómo funciona el tutor, qué hace la inteligencia artificial y qué pasa con tus datos.</p>
        </div>
      </header>
      <Faq items={items()} />
      <p className="text-sm text-muted-foreground">
        <Link href="/como-funciona" className="font-medium underline underline-offset-2">¿Cómo funciona Eduka?</Link> ·{" "}
        <Link href="/privacidad" className="font-medium underline underline-offset-2">Aviso de privacidad</Link>
      </p>
    </article>
  );
}
