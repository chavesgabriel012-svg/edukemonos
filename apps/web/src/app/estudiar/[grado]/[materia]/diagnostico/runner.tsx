"use client";

import { levelMessage } from "@edukemonos/curriculum";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Markdown } from "@/components/learn/markdown";
import {
  answerItem,
  type DiagnosticResult,
  type DiagnosticStep,
  diagnosticStep,
  finishDiagnostic,
  startDiagnostic,
} from "@/app/estudiar/actions";

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
      <div role="status" className="space-y-4 rounded-xl border p-6">
        {result.status === "completed" && result.level !== undefined ? (
          <>
            <h2 className="text-xl font-semibold">Tu nivel estimado: {result.level.toFixed(1)} de 5</h2>
            <p>{levelMessage(result.level)}</p>
            <p className="text-sm text-muted-foreground">
              Respondiste bien {result.correct} de {result.answered}. El nivel 3 es lo que se espera en el grado. Es una estimación
              con pocas preguntas: practicar la irá afinando.
            </p>
          </>
        ) : (
          <p>No alcanzamos a estimar tu nivel. Puedes intentarlo de nuevo cuando quieras.</p>
        )}
        <Link href={`/estudiar/${grade}/${subject}`} className="inline-block rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
          Ver mi ruta sugerida
        </Link>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="space-y-4 rounded-xl border p-6">
        <p>Son unas 10 preguntas de selección única. Se adaptan a tus respuestas: si aciertas, la siguiente es un poco más difícil; si no, un poco más fácil.</p>
        <p className="text-sm text-muted-foreground">No es un examen y no tiene nota. Sirve para sugerirte por dónde empezar. Si no sabes una respuesta, elige la que te parezca más razonable.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button onClick={begin} disabled={pending} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Preparando…" : "Empezar"}
        </button>
      </div>
    );
  }

  const item = step.item!;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Pregunta {step.answered + 1} de {step.total}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="block h-full bg-primary" style={{ width: `${(step.answered / step.total) * 100}%` }} />
        </span>
      </div>
      <div className="space-y-4 rounded-xl border p-4">
        <Markdown>{item.stem}</Markdown>
        <fieldset disabled={pending} className="space-y-2">
          <legend className="sr-only">Opciones</legend>
          {(item.options ?? []).map((o, k) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${selected === k ? "border-primary bg-secondary" : ""}`}>
              <input type="radio" name="option" value={k} checked={selected === k} onChange={() => setSelected(k)} className="mt-1" />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button onClick={answer} disabled={selected === null || pending}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Guardando…" : step.answered + 1 === step.total ? "Terminar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}
