import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionsGlance } from "@/components/teacher/sections-glance";
import { demoGlance } from "@/lib/teacher";

export const metadata: Metadata = { title: "Mis secciones: demostración" };

/** Demo of a teacher's home with several groups: Math in 7-1 and 7-4, Spanish in 7-1. */
export default async function DemoGlancePage() {
  return (
    <div className="space-y-6">
      <p role="note" className="flex gap-2.5 rounded-[16px] border border-violeta/30 bg-[#EEEBFE] p-4 text-sm text-tinta">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-violeta" />
        <span>
          <strong>Datos de demostración.</strong> Un docente que da Matemáticas en 7-1 y 7-4 y Español en 7-1: ve sus grupos lado a
          lado, con los mismos números que el panel de cada uno. Estudiantes ficticios, temas reales de 7.º año.
        </span>
      </p>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-4xl font-bold">Mis secciones</h1>
        <Link href="/docente/demo" className="text-sm font-medium underline underline-offset-2">Abrir el panel de una sección</Link>
      </div>
      <SectionsGlance sections={await demoGlance()} demo />
    </div>
  );
}
