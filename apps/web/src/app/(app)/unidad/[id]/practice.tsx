"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Kemo } from "@/components/brand/logo";
import { Choices } from "@/components/learn/choices";
import { ContentBadge } from "@/components/learn/content-badge";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { type AnswerFeedback, answerItem, nextPracticeItem } from "@/app/(app)/estudiar/actions";
import { action } from "@/components/ui/action";
import { card } from "@/components/ui/styles";
import { markActivity } from "@/lib/activity";
import { brand } from "@/lib/brand";
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

  useEffect(() => { load(null); }, [load]);

  function check() {
    if (!item || selected === null) return;
    startTransition(async () => {
      const r = await answerItem(item.id, selected, Date.now() - shownAt.current);
      if (!r.ok) return setError(r.error);
      setFeedback(r.data);
      markActivity();
      setCount((c) => ({ answered: c.answered + 1, correct: c.correct + (r.data.is_correct ? 1 : 0) }));
    });
  }

  if (item === undefined) return <p className={`${card} text-muted-foreground`}>Cargando ejercicio…</p>;
  if (item === null) return <p className="rounded-[22px] border border-dashed p-5 text-muted-foreground">Este tema todavía no tiene ejercicios publicados.</p>;

  const options = item.options ?? [];
  const wrongPick = feedback && !feedback.is_correct ? selected : null;
  return (
    <section aria-labelledby="practice-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="practice-title" className="font-heading text-2xl font-bold">Ejercicio</h2>
        <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground uppercase">
          {count.answered > 0 && (
            <span className="rounded-full bg-lima px-2.5 py-1 font-semibold text-tinta">{count.correct} de {count.answered} correctas</span>
          )}
          <span className="flex items-center gap-1.5" aria-label={`Dificultad ${item.difficulty} de 5`}>
            Dificultad
            <span className="flex gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-2.5 w-1.5 rounded-full ${n <= item.difficulty ? "bg-violeta" : "bg-secondary"}`} />)}
            </span>
          </span>
        </span>
      </div>
      <div className={`${card} space-y-5`}>
        <ContentBadge reviewed={item.reviewer_id !== null} />
        <Markdown>{item.stem}</Markdown>
        <Choices options={options} selected={selected} onSelect={setSelected} disabled={feedback !== null || pending}
          correct={feedback?.correct_index ?? null} wrong={wrongPick} />

        {!feedback ? (
          <button onClick={check} disabled={selected === null || pending} className={action()}>
            {pending ? "Revisando…" : "Revisar respuesta"}
          </button>
        ) : (
          <div role="status" className="space-y-4">
            <p className={`flex items-center gap-3 rounded-[16px] p-3.5 font-heading text-xl font-bold ${feedback.is_correct ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>
              <Kemo size={40} mood={feedback.is_correct ? "happy" : "think"} background={feedback.is_correct ? brand.lima : brand.violeta} />
              {feedback.is_correct ? "¡Correcto!" : "Todavía no. Mira por qué:"}
            </p>
            {!feedback.is_correct && selected !== null && feedback.distractor_explanations?.[selected] && (
              <p>{feedback.distractor_explanations[selected]}</p>
            )}
            {feedback.explanation && (
              <div className="rounded-[16px] bg-background p-4 text-sm">
                <p className="mb-1 font-mono text-xs text-muted-foreground uppercase">Explicación</p>
                <Markdown>{feedback.explanation}</Markdown>
              </div>
            )}
            {!feedback.saved && (
              <p className="text-xs text-muted-foreground">Tu avance no se está guardando en este momento, pero puedes seguir practicando.</p>
            )}
            <button onClick={() => load(item.id)} disabled={pending} className={action()}>
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
