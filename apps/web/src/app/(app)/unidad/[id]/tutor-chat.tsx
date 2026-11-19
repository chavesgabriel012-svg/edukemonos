"use client";

import { ArrowUp, Check, Copy, MessageSquarePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openTutor, type TutorMessage } from "@/app/(app)/estudiar/actions";
import { Kemo } from "@/components/brand/logo";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { action } from "@/components/ui/action";
import { Notice } from "@/components/ui/notice";
import { Loading, Skeleton } from "@/components/ui/skeleton";
import { markActivity } from "@/lib/activity";
import { brand } from "@/lib/brand";

interface Help {
  emergency: { name: string; phone: string; description: string };
  resources: { name: string; phone?: string; description?: string }[];
  trustedAdultMessage: string;
}

interface Shown {
  id: string | null;
  role: "user" | "assistant";
  content: string;
  flags: string[];
  /** The reply hit the output cap and stops mid-way. */
  truncated?: boolean;
}

type TutorEvent = {
  type: string;
  text?: string;
  sessionId?: string;
  messageId?: string;
  flags?: string[];
  message?: string;
  truncated?: boolean;
  used?: number;
};

const RISK = ["distress", "abuse"];
const PERSONAL = ["personal_data", "personal_data_request"];

/** Ways to start that work for any unit; tapping one fills the box so the student can edit it. */
const STARTERS = [
  "No entiendo este tema, ¿por dónde empiezo?",
  "¿Me explicas con un ejemplo?",
  "Dame un ejercicio para practicar",
];

function HelpCard({ help }: { help: Help }) {
  return (
    <Notice tone="help" role="note" className="space-y-2">
      <p className="font-heading text-lg font-bold">Hay personas que quieren ayudarte.</p>
      <p>{help.trustedAdultMessage}</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>{help.emergency.name}: {help.emergency.phone}</strong>. {help.emergency.description}</li>
        {help.resources.map((r) => (
          <li key={r.name}>{r.name}{r.phone ? `: ${r.phone}` : ""}{r.description ? `. ${r.description}` : ""}</li>
        ))}
      </ul>
    </Notice>
  );
}

/** Chat with the Socratic tutor about one unit. Answers stream in as they are written. */
export function TutorChat({ unitId, help, limits }: { unitId: string; help: Help; limits: { perSession: number; perDay: number } }) {
  const [messages, setMessages] = useState<Shown[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    openTutor(unitId).then((r) => {
      if (!r.ok) setError(r.error);
      else {
        setSessionId(r.data.sessionId);
        setMessages(r.data.messages.map((m: TutorMessage) => ({ id: m.id, role: m.role, content: m.content, flags: m.safety_flags })));
      }
      setReady(true);
    });
  }, [unitId]);

  // Follow the answer as it streams in, unless the student scrolled up to read.
  const count = messages.length;
  useEffect(() => {
    if (count) bottom.current?.scrollIntoView({ block: "end" });
  }, [count]);
  useEffect(() => {
    if (!busy) return;
    const nearEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    if (nearEnd) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const used = messages.filter((m) => m.role === "user").length;
  const full = used >= limits.perSession;

  function newConversation() {
    setSessionId(null);
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  async function ask(text: string) {
    if (!text || busy || full) return;
    setBusy(true);
    setError(null);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    markActivity();
    setMessages((m) => [...m, { id: null, role: "user", content: text, flags: [] }, { id: null, role: "assistant", content: "", flags: [] }]);
    // When nothing was answered, the question goes back to the box so it is not lost.
    let received = false;
    const failed = (message: string) => {
      setError(message);
      if (received) return;
      setMessages((m) => m.slice(0, -2));
      setInput((current) => current || text);
    };
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ unitId, sessionId, message: text }),
      });
      if (!res.body) throw new Error("sin respuesta");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l) as TutorEvent;
          if (ev.type === "session") {
            setSessionId(ev.sessionId ?? null);
            setMessages((m) => m.map((x, i) => (i === m.length - 2 ? { ...x, flags: ev.flags ?? [] } : x)));
          } else if (ev.type === "delta") {
            received = received || Boolean(ev.text);
            setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + (ev.text ?? "") } : x)));
          } else if (ev.type === "done") {
            setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, id: ev.messageId ?? null, flags: ev.flags ?? [], truncated: ev.truncated === true } : x)));
          } else if (ev.type === "error") {
            failed(ev.message ?? "Kemo no pudo responder.");
          }
        }
      }
    } catch {
      failed("Se perdió la conexión con Kemo. Revisa tu internet e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const showHelp = messages.some((m) => m.flags.some((f) => RISK.includes(f)));
  const left = limits.perSession - used;
  return (
    <section aria-labelledby="tutor-title" className="mx-auto flex max-w-3xl flex-col">
      <h2 id="tutor-title" className="sr-only">Pregúntale a Kemo</h2>

      {showHelp && <div className="mb-4"><HelpCard help={help} /></div>}

      <div className="space-y-6 pb-4" aria-live="polite">
        {!ready && (
          <Loading label="Abriendo tu conversación…" className="space-y-6">
            <Skeleton className="ml-auto h-12 w-2/3 rounded-[24px]" />
            <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /><Skeleton className="h-4 w-2/3" /></div>
          </Loading>
        )}

        {ready && messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 px-2 pt-6 pb-2 text-center sm:pt-10">
            <Kemo size={64} mood="normal" background={brand.lima} />
            <div className="space-y-1.5">
              <p className="font-heading text-2xl font-bold text-balance sm:text-3xl">¿En qué te ayudo con este tema?</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground text-pretty">
                Kemo te guía con pistas antes que respuestas. Es una IA y puede equivocarse; no compartas datos personales.
              </p>
            </div>
            <ul className="grid w-full gap-2 pt-2 sm:grid-cols-3">
              {STARTERS.map((q) => (
                <li key={q}>
                  <button type="button" onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="h-full w-full rounded-[18px] border bg-card px-4 py-3 text-left text-sm font-medium transition hover:border-violeta/40 hover:bg-secondary focus-visible:outline-2">
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.length > 0 && (
          <div className="flex justify-end">
            <button type="button" onClick={newConversation} disabled={busy} className={action({ variant: "soft", size: "sm" })}>
              <MessageSquarePlus aria-hidden strokeWidth={2.5} className="size-4" />
              Nueva conversación
            </button>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === "assistant" ? (
            <div key={i} className="flex gap-3">
              <Kemo size={30} mood={m.content ? "normal" : "think"} background={brand.lima} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="sr-only">Kemo dice:</p>
                {m.content ? <Markdown>{m.content}</Markdown> : (
                  <span role="status" className="typing-dots flex h-7 items-center gap-1" aria-label="Kemo está escribiendo">
                    <i className="size-2 rounded-full bg-muted-foreground" /><i className="size-2 rounded-full bg-muted-foreground" /><i className="size-2 rounded-full bg-muted-foreground" />
                  </span>
                )}
                {m.truncated && (
                  <p className="rounded-[12px] bg-secondary px-3 py-2 text-sm text-muted-foreground">
                    La respuesta se cortó porque era muy larga.{" "}
                    {i === messages.length - 1 && !busy && !full && (
                      <button type="button" onClick={() => ask("Continúa, por favor.")} className="font-semibold text-violeta underline underline-offset-2">
                        Pedirle que continúe
                      </button>
                    )}
                  </p>
                )}
                {m.content && !(busy && i === messages.length - 1) && (
                  <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                    <CopyButton text={m.content} />
                    {m.id && <ReportButton targetType="tutor_message" targetId={m.id} />}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-end gap-1.5">
              <p className="sr-only">Tú:</p>
              <div className="max-w-[85%] rounded-[24px] bg-secondary px-4 py-2.5 sm:max-w-[75%]">
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.flags.some((f) => PERSONAL.includes(f)) && (
                <p className="text-right text-xs text-muted-foreground">
                  {m.flags.includes("personal_data")
                    ? "Quitamos los datos personales de tu mensaje antes de enviarlo a Kemo."
                    : "Recuerda: aquí no hace falta compartir datos personales."}
                </p>
              )}
            </div>
          )
        ))}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-0 z-20 -mx-2 bg-linear-to-t from-background from-70% to-transparent px-2 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && <p role="alert" className="mb-2 rounded-[12px] bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>}
        {full ? (
          <Notice className="flex flex-wrap items-center justify-between gap-3">
            <span>Esta conversación llegó a su límite.</span>
            <button type="button" onClick={newConversation} className={action({ size: "md" })}>Empezar una nueva</button>
          </Notice>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); ask(input.trim()); }}
            className="flex items-end gap-2 rounded-[28px] border bg-card p-2 pl-4 shadow-[0_12px_32px_-18px_rgba(23,19,42,0.35)] transition focus-within:border-violeta/50">
            <label className="min-w-0 flex-1 py-1.5">
              <span className="sr-only">Tu mensaje para Kemo</span>
              <textarea ref={inputRef} value={input} rows={1} maxLength={2000} disabled={!ready}
                onChange={(e) => { setInput(e.target.value); grow(e.currentTarget); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                placeholder="Pregúntale a Kemo…"
                className="block max-h-48 w-full resize-none bg-transparent text-base leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60" />
            </label>
            <button disabled={busy || !input.trim() || !ready} aria-label="Enviar"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violeta text-white transition hover:bg-violeta/90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:bg-muted disabled:text-muted-foreground">
              <ArrowUp aria-hidden strokeWidth={2.75} className="size-5" />
            </button>
          </form>
        )}
        {!full && left <= 3 && used > 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {left === 1 ? "Te queda 1 mensaje en esta conversación." : `Te quedan ${left} mensajes en esta conversación.`}
          </p>
        )}
      </div>
    </section>
  );
}

/** The box grows with what the student writes, up to its max height. */
function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" aria-label={copied ? "Copiado" : "Copiar la respuesta"} title="Copiar"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {})}
      className="flex size-8 items-center justify-center rounded-[10px] transition hover:bg-secondary hover:text-foreground focus-visible:outline-2">
      {copied ? <Check aria-hidden strokeWidth={2.5} className="size-4" /> : <Copy aria-hidden strokeWidth={2.25} className="size-4" />}
    </button>
  );
}
