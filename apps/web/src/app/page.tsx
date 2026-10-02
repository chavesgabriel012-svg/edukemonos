import Link from "next/link";
import { GRADE_LABEL, GRADES } from "@/lib/learn";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">{site.name}</h1>
        <p className="max-w-prose text-lg text-muted-foreground">
          Estudia gratis los temas de sétimo, octavo y noveno año con material alineado a los programas del MEP, ejercicios
          con explicación y una prueba diagnóstica que te dice por dónde empezar.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">¿En qué año estás?</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {GRADES.map((g) => (
            <li key={g}>
              <Link href={`/estudiar/${g}`}
                className="flex h-full flex-col rounded-xl border p-5 transition hover:border-primary hover:bg-secondary focus-visible:outline-2">
                <span className="text-3xl font-bold text-primary">{g}.º</span>
                <span className="text-lg">{GRADE_LABEL[g]} año</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-sm text-muted-foreground">
        No necesitas cuenta: tu avance se guarda en este dispositivo. ¿Tu docente te dio un código?{" "}
        <Link href="/unirme" className="font-medium underline underline-offset-2">Únete a tu sección</Link>.
      </p>
    </section>
  );
}
