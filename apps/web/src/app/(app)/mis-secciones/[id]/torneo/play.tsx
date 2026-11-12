"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { answerTournament, type TournamentPlay, tournamentQuestions } from "@/app/(app)/estudiar/actions";
import { Kemo } from "@/components/brand/logo";
import { Choices } from "@/components/learn/choices";
import { ContentBadge } from "@/components/learn/content-badge";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { action } from "@/components/ui/action";
import { card } from "@/components/ui/styles";
import type { PieceFeedback } from "@/lib/games";
import { markActivity } from "@/lib/activity";
import { brand } from "@/lib/brand";

/**
 * The student's tournament questions, one at a time. No clock: every answer is graded in the
 * database, counts for mastery and adds to the team. Answered questions do not come back.
 */
export function TournamentPlayer({ tournamentId, backHref }: { tournamentId: string; backHref: string }) {
  const [play, setPlay] = useState<TournamentPlay | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<PieceFeedback | null>(null);
  const [right, setRight] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    tournamentQuestions(tournamentId).then((r) => {
      if (!r.ok) setError(r.error);
      else setPlay(r.data);
    });
  }, [tournamentId]);

  if (error && !play) {
    return (
      <div className={`${card} space-y-4`}>
        <p>{error}</p>
        <Link href={backHref} className={action({ size: "md" })}>Volver a mi sección</Link>
      </div>
    );
  }
  if (!play) return <p className={`${card} text-muted-foreground`}>Preparando tus preguntas…</p>;

  const done = play.total - play.questions.length;
  const q = play.questions[index];
  if (!q) {
    return (
      <div role="status" className={`${card} space-y-4`}>
        <Kemo size={72} mood="happy" background={brand.lima} />
        <h2 className="font-heading text-3xl font-bold">¡Listo!</h2>
        <p>
          {play.questions.length > 0
            ? `Respondiste tus ${play.total} preguntas y acertaste ${right} en esta vuelta.`
            : "Ya respondiste todas tus preguntas del torneo."}{" "}
          Hasta el domingo, todo lo que practiques en los temas del torneo también suma a tu equipo.
        </p>
        <Link href={backHref} className={action()}>Ver cómo va mi equipo</Link>
      </div>
    );
  }

  const fill = q.game_public?.mechanic === "fill";
  const stem = fill ? q.game_public!.stem ?? q.stem : q.stem;
  const options = fill ? q.game_public!.options ?? [] : q.options ?? [];
  const key = fill ? feedback?.game_answer?.index ?? null : feedback?.correct_index ?? null;

  function check() {
    if (selected === null) return;
    startTransition(async () => {
      setError(null);
      const r = await answerTournament(tournamentId, q.id, selected);
      if (!r.ok) return setError(r.error);
      setFeedback(r.data);
      markActivity();
      if (r.data.is_correct) setRight((n) => n + 1);
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground uppercase">
        <span>Pregunta {done + index + 1} de {play.total}</span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <span className="block h-full rounded-full bg-violeta transition-[width]" style={{ width: `${((done + index) / play.total) * 100}%` }} />
        </span>
      </div>
      <div className={`${card} space-y-5`}>
        <ContentBadge reviewed={q.reviewed} />
        <Markdown>{stem}</Markdown>
        <Choices options={options} selected={selected} onSelect={setSelected} disabled={feedback !== null || pending}
          correct={feedback ? key : null} wrong={feedback && !feedback.is_correct ? selected : null} />
        {!feedback ? (
          <button onClick={check} disabled={selected === null || pending} className={action()}>
            {pending ? "Revisando…" : "Responder"}
          </button>
        ) : (
          <div role="status" className="space-y-4">
            <p className={`flex items-center gap-3 rounded-[16px] p-3.5 font-heading text-xl font-bold ${feedback.is_correct ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}>
              <Kemo size={40} mood={feedback.is_correct ? "happy" : "think"} background={feedback.is_correct ? brand.lima : brand.violeta} />
              {feedback.is_correct ? "¡Punto para tu equipo!" : "Esta vez no. Mira por qué:"}
            </p>
            {feedback.explanation && (
              <div className="rounded-[16px] bg-background p-4 text-sm">
                <Markdown>{feedback.explanation}</Markdown>
              </div>
            )}
            <button onClick={next} className={action()}>
              {index + 1 < play.questions.length ? "Siguiente pregunta" : "Terminar"}
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <ReportButton targetType="item" targetId={q.id} />
      </div>
    </div>
  );
}
