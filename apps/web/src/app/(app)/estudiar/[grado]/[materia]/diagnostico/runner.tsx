"use client";

import { levelMessage } from "@edukemonos/curriculum";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Kemo } from "@/components/brand/logo";
import { Choices } from "@/components/learn/choices";
import { Markdown } from "@/components/learn/markdown";
import { action } from "@/components/ui/action";
import { card } from "@/components/ui/styles";
import {
  answerItem,
  type DiagnosticResult,
  type DiagnosticStep,
  diagnosticStep,
  finishDiagnostic,
  startDiagnostic,
} from "@/app/(app)/estudiar/actions";
import { brand } from "@/lib/brand";

/**
 * Adaptive diagnostic: no right/wrong feedback per question (that is what practice is for);
 * at the end, a kind summary and the suggested route on the subject page.
 */
export function DiagnosticRunner({ subject, grade }: { subject: string; grade: number }) {
  const [step, setStep] = useState<DiagnosticStep | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shownAt = useRef(0);

  function show(next: DiagnosticStep) {
    if (next.item === null) {
      startTransition(async () => {
        const r = await finishDiagnostic(next.diagnosticId);
        if (!r.ok) return setError(r.error);
        setResult(r.data);
      });
      return;
    }
    setStep(next);
    setSelected(null);
    shownAt.current = Date.now();
  }

  function begin() {
    startTransition(async () => {
      setError(null);
      const r = await startDiagnostic(subject, grade);
      if (!r.ok) return setError(r.error);
      show(r.data);
    });
  }

  function answer() {
    if (!step?.item || selected === null) return;
    const { diagnosticId, item } = step;
    startTransition(async () => {
      setError(null);
      const a = await answerItem(item.id, selected, Date.now() - shownAt.current, diagnosticId);
      if (!a.ok) return setError(a.error);
      const next = await diagnosticStep(diagnosticId);
      if (!next.ok) return setError(next.error);
      show(next.data);
    });
  }

  if (result) {
    return (
      <div role="status" className={`${card} space-y-4`}>
        <Kemo size={72} mood={result.status === "completed" ? "happy" : "think"} background={brand.lima} />
        {result.status === "completed" && result.level !== undefined ? (
          <>
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">Tu nivel estimado</p>
            <h2 className="font-heading text-5xl leading-none font-bold">
              {result.level.toFixed(1).replace(".", ",")} <span className="text-2xl text-muted-foreground">de 5</span>
            </h2>
            <div className="flex gap-1.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`h-2 flex-1 rounded-full ${n <= Math.round(result.level!) ? "bg-violeta" : "bg-secondary"}`} />
              ))}
            </div>
            <p className="text-lg">{levelMessage(result.level)}</p>
            <p className="text-sm text-muted-foreground">
              Respondiste bien {result.correct} de {result.answered}. El nivel 3 es lo que se espera en el grado. Es una estimación
              con pocas preguntas: practicar la irá afinando.
            </p>
          </>
        ) : (
          <p>No alcanzamos a estimar tu nivel. Puedes intentarlo de nuevo cuando quieras.</p>
        )}
        <Link href={`/estudiar/${grade}/${subject}`} className={action()}>
          Ver mi ruta sugerida
        </Link>
      </div>
    );
  }

  if (!step) {
    return (
      <div className={`${card} space-y-4`}>
        <Kemo size={72} mood="down" background={brand.lima} />
        <p className="text-lg">Son unas 10 preguntas de selección única que se adaptan a tus respuestas: si aciertas, la siguiente es un poco más difícil; si no, un poco más fácil.</p>
        <p className="text-sm text-muted-foreground">No es un examen ni tiene nota, solo sirve para sugerirte por dónde empezar. Si no sabes una respuesta, elige la que te parezca más razonable.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button onClick={begin} disabled={pending} className={action()}>
          {pending ? "Preparando…" : "Empezar"}
        </button>
      </div>
    );
  }

  const item = step.item!;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground uppercase">
        <span>Pregunta {step.answered + 1} de {step.total}</span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <span className="block h-full rounded-full bg-violeta transition-[width]" style={{ width: `${(step.answered / step.total) * 100}%` }} />
        </span>
      </div>
      <div className={`${card} space-y-5`}>
        <Markdown>{item.stem}</Markdown>
        <Choices options={item.options ?? []} selected={selected} onSelect={setSelected} disabled={pending} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button onClick={answer} disabled={selected === null || pending} className={action()}>
          {pending ? "Guardando…" : step.answered + 1 === step.total ? "Terminar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
