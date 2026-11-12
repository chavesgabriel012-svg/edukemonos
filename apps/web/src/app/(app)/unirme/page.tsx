import type { Metadata } from "next";
import { Kemo } from "@/components/brand/logo";
import { card } from "@/components/ui/styles";
import { brand } from "@/lib/brand";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Únete a tu sección" };

export default function JoinPage() {
  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Kemo size={64} background={brand.lima} />
        <div className="space-y-1">
          <h1 className="font-heading text-4xl leading-none font-bold">Únete a tu sección</h1>
          <p className="text-muted-foreground">
            Escribe el código que te dio tu docente o tu docente guía, junto con tu nombre. Con el código de tu grupo entras una
            sola vez a todas tus materias, y cada docente podrá ver tu avance en la suya.
          </p>
        </div>
      </div>
      <div className={card}>
        <JoinForm />
      </div>
    </section>
  );
}
