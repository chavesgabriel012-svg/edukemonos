import type { Metadata } from "next";
import Link from "next/link";
import { RETENTION_DAYS_CHAT } from "@/lib/tutor-server";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacyPage() {
  return (
    <article className="max-w-prose space-y-4 [&_li]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1.5">
      <h1 className="text-2xl font-bold">Aviso de privacidad</h1>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Borrador pendiente de revisión legal (Ley 8968 de Protección de la Persona frente al
        Tratamiento de sus Datos Personales). Este texto no es definitivo.
      </p>

      <h2 className="text-xl font-semibold">¿Qué datos usamos?</h2>
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

      <h2 className="text-xl font-semibold">¿Qué recibe la inteligencia artificial?</h2>
      <ul>
        <li>Tu nombre nunca se envía al modelo de inteligencia artificial.</li>
        <li>
          Al tutor le llega tu mensaje, el tema que estudias y tu dominio estimado. Antes de enviarlo quitamos los datos
          personales que reconocemos (nombres, cédulas, teléfonos, correos, direcciones y colegios).
        </li>
        <li>Usamos modelos Claude, de Anthropic.</li>
      </ul>

      <h2 className="text-xl font-semibold">¿Qué puedes hacer?</h2>
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
