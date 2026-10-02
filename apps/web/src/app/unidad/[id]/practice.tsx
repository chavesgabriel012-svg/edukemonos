"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ContentBadge } from "@/components/learn/content-badge";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { type AnswerFeedback, answerItem, nextPracticeItem } from "@/app/estudiar/actions";
import type { PublicItem } from "@/lib/learn";

/** One exercise at a time: answer, get the explanation, go to the next. Graded in the database. */
export function Practice({ unitId }: { unitId: string }) {
  const [item, setItem] = useState<PublicItem | null | undefined>(undefined);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState({ answered: 0, correct: 0 });
  const [pending, startTransition] = useTransition();
  const shownAt = useRef(0);

  const load = useCallback(
    (exclude: string | null) =>
      startTransition(async () => {
        setError(null);
        const r = await nextPracticeItem(unitId, exclude);
        if (!r.ok) return setError(r.error);
        setItem(r.data);
        setSelected(null);
        setFeedback(null);
        shownAt.current = Date.now();
      }),
    [unitId],
  );

  useEffect(() => load(null), [load]);

  function check() {
    if (!item || selected === null) return;
    startTransition(async () => {
      const r = await answerItem(item.id, selected, Date.now() - shownAt.current);
      if (!r.ok) return setError(r.error);
      setFeedback(r.data);
      setCount((c) => ({ answered: c.answered + 1, correct: c.correct + (r.data.is_correct ? 1 : 0) }));
    });
  }

  if (item === undefined) return <p className="text-muted-foreground">Cargando ejercicio…</p>;
  if (item === null) return <p className="text-muted-foreground">Esta unidad todavía no tiene ejercicios publicados.</p>;

  const options = item.options ?? [];
  return (
    <section aria-labelledby="practice-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="practice-title" className="text-xl font-semibold">Ejercicio</h2>
        <span className="text-sm text-muted-foreground">
          {count.answered > 0 ? `${count.correct} de ${count.answered} correctas en esta sesión` : `Dificultad ${item.difficulty} de 5`}
        </span>
      </div>
      <div className="space-y-4 rounded-xl border p-4">
        <ContentBadge reviewed={item.reviewer_id !== null} />
        <Markdown>{item.stem}</Markdown>
        <fieldset disabled={feedback !== null || pending} className="space-y-2">
          <legend className="sr-only">Opciones</legend>
          {options.map((o, k) => {
            const isKey = feedback && k === feedback.correct_index;
            const isWrongPick = feedback && k === selected && !feedback.is_correct;
            return (
              <label key={k}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${selected === k ? "border-primary bg-secondary" : ""} ${isKey ? "border-emerald-600 bg-emerald-50" : ""} ${isWrongPick ? "border-amber-600 bg-amber-50" : ""}`}>
                <input type="radio" name="option" value={k} checked={selected === k} onChange={() => setSelected(k)} className="mt-1" />
                <span>{o}</span>
              </label>
            );
          })}
        </fieldset>

        {!feedback ? (
          <button onClick={check} disabled={selected === null || pending}
            className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
            {pending ? "Revisando…" : "Revisar respuesta"}
          </button>
        ) : (
          <div role="status" className="space-y-3">
            <p className={`font-semibold ${feedback.is_correct ? "text-emerald-700" : "text-amber-800"}`}>
              {feedback.is_correct ? "¡Correcto!" : "Todavía no. Mira por qué:"}
            </p>
            {!feedback.is_correct && selected !== null && feedback.distractor_explanations?.[selected] && (
              <p className="text-sm">{feedback.distractor_explanations[selected]}</p>
            )}
            {!feedback.saved && (
              <p className="text-xs text-muted-foreground">Tu avance no se está guardando en este momento, pero puedes seguir practicando.</p>
            )}
            {feedback.explanation && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <Markdown>{feedback.explanation}</Markdown>
              </div>
            )}
            <button onClick={() => load(item.id)} disabled={pending}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
              Siguiente ejercicio
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <ReportButton targetType="item" targetId={item.id} />
      </div>
    </section>
  );
}
