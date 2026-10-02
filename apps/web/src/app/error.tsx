"use client";

import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section role="alert" className="mx-auto flex max-w-md flex-col items-center gap-5 py-10 text-center">
      <Kemo size={120} mood="down" background={brand.lima} />
      <h1 className="font-heading text-4xl leading-none font-bold">Algo falló</h1>
      <p className="text-muted-foreground">
        No es tu culpa. Intenta de nuevo en un momento. Si se repite, comparte este código con tu docente:{" "}
        <span className="font-mono">{error.digest ?? "sin código"}</span>.
      </p>
      <button onClick={() => retry()}
        className="inline-flex h-[52px] items-center rounded-[14px] bg-primary px-6 font-semibold text-primary-foreground focus-visible:outline-2">
        Intentar de nuevo
      </button>
    </section>
  );
}
