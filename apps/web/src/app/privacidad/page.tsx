import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacyPage() {
  return (
    <article className="max-w-prose space-y-4">
      <h1 className="text-2xl font-bold">Aviso de privacidad</h1>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Borrador pendiente de revisión legal (Ley 8968 de Protección de la Persona frente al
        Tratamiento de sus Datos Personales). Este texto no es definitivo.
      </p>
      <h2 className="text-xl font-semibold">Qué datos usamos</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Puedes estudiar sin registrarte. Tu progreso se guarda asociado a este dispositivo.</li>
        <li>
          Si te unes a una sección de tu docente, guardamos el nombre que escribas, la sección y el
          trimestre, para que tu docente pueda reconocerte.
        </li>
        <li>Tu nombre nunca se envía al modelo de inteligencia artificial.</li>
      </ul>
    </article>
  );
}
