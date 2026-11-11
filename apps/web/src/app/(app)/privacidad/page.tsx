import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { RETENTION_DAYS_CHAT, TUTOR_LIMITS } from "@/lib/tutor-server";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 leading-relaxed [&_h2]:pt-3 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-bold [&_li]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1.5">
      <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Aviso de privacidad</h1>
      <Notice tone="warn">
        Borrador pendiente de revisión legal (Ley 8968 de Protección de la Persona frente al
        Tratamiento de sus Datos Personales). Este texto no es definitivo.
      </Notice>

      <h2>¿Qué datos usamos?</h2>
      <ul>
        <li>
          Puedes estudiar sin registrarte. Tu progreso (respuestas a ejercicios, diagnósticos y dominio estimado por
          tema) se guarda asociado a este navegador, sin correo ni contraseña.
        </li>
        <li>
          Si te unes a una sección de tu docente, guardamos el nombre que escribas, la sección y el trimestre, para que tu
          docente pueda reconocerte y ver tu avance.
        </li>
        <li>
          Las conversaciones con el tutor se guardan, sin los datos personales que reconocemos, y se borran a los{" "}
          {RETENTION_DAYS_CHAT} días. Tu docente no puede leerlas.
        </li>
        <li>De las tareas de escritura solo guardamos cuántos errores hubo de cada tipo, no tu texto.</li>
      </ul>

      <h2>¿Qué recibe la inteligencia artificial?</h2>
      <ul>
        <li>Tu nombre nunca se envía al modelo de inteligencia artificial.</li>
        <li>
          Al tutor le llega tu mensaje, el tema que estudias y tu dominio estimado. Antes de enviarlo quitamos los datos
          personales que reconocemos (nombres, cédulas, teléfonos, correos, direcciones y colegios).
        </li>
        <li>
          Si un mensaje pide o anuncia datos personales, o intenta cambiar las reglas del tutor, se marca para que el
          tutor responda con cuidado. Los mensajes con señales de malestar muestran recursos de ayuda.
        </li>
        <li>Usamos modelos Claude, de Anthropic.</li>
      </ul>

      <h2>¿Qué límites hay?</h2>
      <ul>
        <li>Hasta {TUTOR_LIMITS.perSession} mensajes por conversación y {TUTOR_LIMITS.perDay} por día con el tutor.</li>
        <li>El docente de una sección ve el avance y los temas consultados, y cada vez que entra al panel queda registrado.</li>
      </ul>

      <h2>¿Qué puedes hacer?</h2>
      <ul>
        <li>No escribir datos personales en el tutor ni en las tareas.</li>
        <li>Borrar los datos del navegador para empezar de cero en este dispositivo.</li>
      </ul>

      <p className="text-sm text-muted-foreground">
        Más detalles en <Link href="/ia" className="underline underline-offset-2">Kemo y la IA</Link>.
      </p>
    </article>
  );
}
