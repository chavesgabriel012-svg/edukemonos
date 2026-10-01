import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
      <p className="max-w-prose text-lg text-muted-foreground">
        Estudia gratis los temas de sétimo, octavo y noveno año con material alineado a los
        programas del MEP, una prueba diagnóstica y un tutor que te guía paso a paso.
      </p>
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Estamos construyendo la plataforma. Muy pronto podrás elegir tu grado y materia.
      </p>
    </section>
  );
}
