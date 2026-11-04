import type { Metadata } from "next";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Únete a tu sección" };

export default function JoinPage() {
  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Únete a tu sección</h1>
        <p className="text-muted-foreground">
          Escribe el código que te dio tu docente o tu docente guía, junto con tu nombre. Con el código de tu grupo entras una sola
          vez a todas tus materias, y cada docente podrá ver tu avance en la suya y ayudarte mejor.
        </p>
      </div>
      <JoinForm />
    </section>
  );
}
