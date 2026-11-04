"use client";

import { GAME_LABELS, type GameMode } from "@edukemonos/curriculum";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, useTransition } from "react";
import { Kemo } from "@/components/brand/logo";
import { ContentBadge } from "@/components/learn/content-badge";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { answerGamePiece, finishGame, startGame } from "@/app/estudiar/actions";
import { markActivity } from "@/lib/activity";
import { brand } from "@/lib/brand";
import type { GameResult, GamePieceView, GameRunView, PieceFeedback } from "@/lib/games";

const button = "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50";
const LETTERS = "ABCDEF";

/**
 * Mini-games of a unit (docs/producto/gamificacion.md §6). The mechanics are fixed code; the content
 * comes verified from the database. Every answer counts for mastery like practice. Nothing rewards
 * speed: there is no timer anywhere.
 */
export function Games({ unitId, available }: { unitId: string; available: Partial<Record<GameMode, number>> }) {
  const [run, setRun] = useState<GameRunView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const modes = (Object.keys(GAME_LABELS) as GameMode[]).filter((m) => (available[m] ?? 0) > 0);

  const play = (mode: GameMode) =>
    start(async () => {
      setError(null);
      const r = await startGame(unitId, mode);
      if (!r.ok) return setError(r.error);
      setRun(r.data);
    });

  if (run) return <Runner key={run.run} run={run} onExit={() => setRun(null)} onAgain={() => play(run.mode)} />;
  if (modes.length === 0) return <p className="text-muted-foreground">Los juegos de esta unidad todavía están en preparación.</p>;
  return (
    <section aria-labelledby="games-t" className="space-y-4">
      <div className="space-y-1">
        <h2 id="games-t" className="text-xl font-semibold">Elige un juego</h2>
        <p className="text-sm text-muted-foreground">Cada respuesta cuenta para tu dominio, igual que la práctica. Aquí no hay reloj: importa acertar, no la rapidez.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {modes.map((m) => (
          <li key={m}>
            <button type="button" disabled={pending} onClick={() => play(m)}
              className="flex h-full w-full flex-col items-start gap-1 rounded-[20px] border bg-card p-4 text-left transition hover:border-violeta disabled:opacity-60">
              <span className="font-heading text-lg font-bold">{GAME_LABELS[m].name}</span>
              <span className="text-sm text-muted-foreground">{GAME_LABELS[m].how}</span>
            </button>
          </li>
        ))}
      </ul>
      {pending && <p className="text-sm text-muted-foreground">Preparando el juego…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

function Runner({ run, onExit, onAgain }: { run: GameRunView; onExit: () => void; onAgain: () => void }) {
  const [k, setK] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<PieceFeedback | null>(null);
  const [summary, setSummary] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const piece = run.pieces[k];
  const race = run.mode === "ghost_race";

  const submit = (answer: number | number[]) =>
    start(async () => {
      setError(null);
      const r = await answerGamePiece(run.run, piece.id, answer);
      if (!r.ok) return setError(r.error);
      markActivity();
      setFeedback(r.data);
      setResults((x) => [...x, r.data.is_correct]);
    });

  const next = () =>
    start(async () => {
      setFeedback(null);
      if (k + 1 < run.pieces.length) return setK(k + 1);
      const r = await finishGame(run.run);
      if (!r.ok) return setError(r.error);
      setSummary(r.data);
    });

  if (summary) return <Summary run={run} summary={summary} onExit={onExit} onAgain={onAgain} />;
  return (
    <section aria-label={GAME_LABELS[run.mode].name} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{GAME_LABELS[run.mode].name}</h2>
        <span className="font-mono text-sm text-muted-foreground">{k + 1} de {run.pieces.length}</span>
      </div>
      {race && <RaceTrack run={run} results={results} />}
      <div className="space-y-4 rounded-xl border p-4">
        <ContentBadge reviewed={piece.reviewed} />
        <Piece key={piece.id} piece={piece} feedback={feedback} disabled={pending || feedback !== null} onSubmit={submit} />
        {feedback && (
          <div role="status" className="space-y-3">
            <p className={`flex items-center gap-2.5 font-semibold ${feedback.is_correct ? "text-emerald-700" : "text-amber-800"}`}>
              <Kemo size={36} mood={feedback.is_correct ? "happy" : "think"} background={feedback.is_correct ? brand.lima : brand.violeta} />
              {feedback.is_correct ? "¡Correcto!" : "Todavía no. Mira cómo era:"}
            </p>
            {feedback.game_answer?.correction && <p className="text-sm">Corrección: {feedback.game_answer.correction}</p>}
            {feedback.explanation && <div className="rounded-lg bg-muted/50 p-3 text-sm"><Markdown>{feedback.explanation}</Markdown></div>}
            <button type="button" onClick={next} disabled={pending} className={button}>
              {k + 1 < run.pieces.length ? "Siguiente" : "Ver resultado"}
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <ReportButton targetType="item" targetId={piece.id} />
      </div>
      <button type="button" onClick={onExit} className="text-sm underline underline-offset-2">Salir del juego</button>
    </section>
  );
}

/** The race is about right answers, question by question: the ghost advances with its own answers. */
export function RaceTrack({ run, results }: { run: GameRunView; results: boolean[] }) {
  const total = run.pieces.length;
  const mine = results.filter(Boolean).length;
  const ghost = run.rival ? run.rival.pattern.slice(0, results.length).filter(Boolean).length : null;
  const who = run.rival?.kind === "self" ? "Tu mejor carrera" : run.rival?.kind === "peer" ? "Un compañero de tu nivel" : null;
  const bar = (n: number, color: string, label: string) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs"><span>{label}</span><span className="font-mono">{n} de {total}</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={n} aria-label={label}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round((n / total) * 100)}%` }} />
      </div>
    </div>
  );
  return (
    <div className="space-y-2 rounded-[16px] bg-secondary p-3">
      {bar(mine, "bg-violeta", "Tú")}
      {ghost !== null && who ? bar(ghost, "bg-[#9A92B8]", `Fantasma · ${who}`) : <p className="text-xs">Primera carrera en esta unidad: marca tu récord.</p>}
    </div>
  );
}

export function Summary({ run, summary, onExit, onAgain }: { run: GameRunView; summary: GameResult; onExit: () => void; onAgain: () => void }) {
  const ghost = summary.rival ? summary.rival.pattern.filter(Boolean).length : null;
  let race: string | null = null;
  if (run.mode === "ghost_race" && ghost !== null) {
    race = summary.correct > ghost ? "¡Le ganaste al fantasma! Acertaste más." : summary.correct === ghost ? "Empate con el fantasma." : "Esta vez el fantasma acertó más. Cada intento suma a tu dominio.";
  }
  return (
    <section role="status" className="space-y-4 rounded-[22px] border bg-card p-6">
      <Kemo size={64} mood="happy" background={brand.lima} />
      <h2 className="font-heading text-2xl font-bold">Resolviste bien {summary.correct} de {summary.total}</h2>
      {race && <p>{race}</p>}
      {summary.new_record && summary.best_before !== null && <p>¡Nuevo récord en este juego! Antes tenías {summary.best_before}.</p>}
      <p className="text-sm text-muted-foreground">Tus respuestas ya cuentan para tu dominio de la unidad.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onAgain} className={button}>Jugar otra vez</button>
        <button type="button" onClick={onExit} className="inline-flex min-h-11 items-center rounded-md border px-4 py-2 font-medium">Elegir otro juego</button>
      </div>
    </section>
  );
}

export function Piece({ piece, feedback, disabled, onSubmit }: { piece: GamePieceView; feedback: PieceFeedback | null; disabled: boolean; onSubmit: (a: number | number[]) => void }) {
  const p = piece.game_public;
  if (piece.kind === "single_choice" || p?.mechanic === "fill") {
    const stem = p?.mechanic === "fill" ? p.stem : piece.stem;
    const options = p?.mechanic === "fill" ? p.options : piece.options ?? [];
    const key = p?.mechanic === "fill" ? feedback?.game_answer?.index : feedback?.correct_index;
    return <Choice instruction={p?.instruction} stem={stem} options={options} answer={feedback ? key ?? null : undefined} disabled={disabled} onSubmit={onSubmit} />;
  }
  if (p?.mechanic === "pairs") return <Pairs left={p.left} right={p.right} instruction={p.instruction} answer={feedback?.game_answer?.match} disabled={disabled} onSubmit={onSubmit} />;
  if (p?.mechanic === "order") return <Order steps={p.steps} instruction={p.instruction} answer={feedback?.game_answer?.order} disabled={disabled} onSubmit={onSubmit} />;
  if (p?.mechanic === "find_error") return <FindError steps={p.steps} instruction={p.instruction} answer={feedback?.game_answer?.index} disabled={disabled} onSubmit={onSubmit} />;
  return null;
}

function Choice({ instruction, stem, options, answer, disabled, onSubmit }: {
  instruction?: string; stem: string; options: string[]; answer: number | null | undefined; disabled: boolean; onSubmit: (i: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {instruction && <p className="font-medium">{instruction}</p>}
      <Markdown>{stem}</Markdown>
      <fieldset disabled={disabled} className="space-y-2">
        <legend className="sr-only">Opciones</legend>
        {options.map((o, k) => (
          <label key={k} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${selected === k ? "border-primary bg-secondary" : ""} ${answer === k ? "border-emerald-600 bg-emerald-50" : ""}`}>
            <input type="radio" name="option" checked={selected === k} onChange={() => setSelected(k)} className="mt-1" />
            <span>{o}</span>
          </label>
        ))}
      </fieldset>
      {answer === undefined && <button type="button" disabled={disabled || selected === null} onClick={() => onSubmit(selected!)} className={button}>Revisar</button>}
    </div>
  );
}

/** Pairs without dragging: for each item on the left, tap the letter of its pair. */
function Pairs({ left, right, instruction, answer, disabled, onSubmit }: {
  left: string[]; right: string[]; instruction: string; answer?: number[]; disabled: boolean; onSubmit: (m: number[]) => void;
}) {
  const [match, setMatch] = useState<(number | null)[]>(left.map(() => null));
  const pick = (i: number, r: number) => setMatch((m) => m.map((v, k) => (k === i ? r : v === r ? null : v)));
  return (
    <div className="space-y-4">
      <p className="font-medium">{instruction}</p>
      <ol className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
        {right.map((r, k) => <li key={k}><span className="font-mono font-bold">{LETTERS[k]}.</span> {r}</li>)}
      </ol>
      <ul className="space-y-3">
        {left.map((l, i) => (
          <li key={i} className="space-y-1.5">
            <p className="font-medium">{l}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Pareja de ${l}`}>
              {right.map((_, r) => {
                const chosen = match[i] === r;
                const right_ = answer ? answer[i] === r : false;
                return (
                  <button key={r} type="button" disabled={disabled} aria-pressed={chosen} onClick={() => pick(i, r)}
                    className={`size-11 rounded-md border font-mono font-bold ${chosen ? "border-primary bg-primary text-primary-foreground" : ""} ${right_ ? "ring-2 ring-emerald-600" : ""}`}>
                    {LETTERS[r]}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {!answer && <button type="button" disabled={disabled || match.some((v) => v === null)} onClick={() => onSubmit(match as number[])} className={button}>Revisar</button>}
    </div>
  );
}

/** Order without dragging: move each step up or down. */
function Order({ steps, instruction, answer, disabled, onSubmit }: {
  steps: string[]; instruction: string; answer?: number[]; disabled: boolean; onSubmit: (o: number[]) => void;
}) {
  const [order, setOrder] = useState(steps.map((_, i) => i));
  const move = (pos: number, d: -1 | 1) => setOrder((o) => {
    const n = [...o];
    [n[pos], n[pos + d]] = [n[pos + d], n[pos]];
    return n;
  });
  const shown = answer ?? order;
  return (
    <div className="space-y-3">
      <p className="font-medium">{instruction}</p>
      {answer && <p className="text-sm text-muted-foreground">Este es el orden correcto:</p>}
      <ol className="space-y-2">
        {shown.map((s, pos) => (
          <li key={s} className="flex items-center gap-2 rounded-lg border p-2">
            <span className="w-6 text-center font-mono font-bold">{pos + 1}</span>
            <span className="flex-1">{steps[s]}</span>
            {!answer && (
              <span className="flex gap-1">
                <button type="button" aria-label="Subir" disabled={disabled || pos === 0} onClick={() => move(pos, -1)} className="flex size-11 items-center justify-center rounded-md border disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button type="button" aria-label="Bajar" disabled={disabled || pos === shown.length - 1} onClick={() => move(pos, 1)} className="flex size-11 items-center justify-center rounded-md border disabled:opacity-30"><ArrowDown className="size-4" /></button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!answer && <button type="button" disabled={disabled} onClick={() => onSubmit(order)} className={button}>Revisar</button>}
    </div>
  );
}

function FindError({ steps, instruction, answer, disabled, onSubmit }: {
  steps: string[]; instruction: string; answer?: number; disabled: boolean; onSubmit: (i: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <p className="font-medium">{instruction}</p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i}>
            <button type="button" disabled={disabled} aria-pressed={selected === i} onClick={() => setSelected(i)}
              className={`flex min-h-11 w-full items-start gap-3 rounded-lg border p-3 text-left ${selected === i ? "border-primary bg-secondary" : ""} ${answer === i ? "border-amber-600 bg-amber-50" : ""}`}>
              <span className="font-mono font-bold">{i + 1}</span>
              <span>{s}</span>
            </button>
          </li>
        ))}
      </ol>
      {answer === undefined && <button type="button" disabled={disabled || selected === null} onClick={() => onSubmit(selected!)} className={button}>Revisar</button>}
    </div>
  );
}
