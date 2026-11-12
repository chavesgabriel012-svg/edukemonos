"use client";

import { ArrowUp, MessageSquarePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openTutor, type TutorMessage } from "@/app/(app)/estudiar/actions";
import { Kemo } from "@/components/brand/logo";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { action } from "@/components/ui/action";
import { Notice } from "@/components/ui/notice";
import { textarea } from "@/components/ui/styles";
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

  useEffect(() => {
    if (messages.length) bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

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
  return (
    <section aria-labelledby="tutor-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="tutor-title" className="font-heading text-2xl font-bold">Pregúntale a Kemo</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Kemo te guía paso a paso en este tema, con pistas antes que respuestas. Es una inteligencia artificial y puede
            equivocarse. No compartas datos personales.
          </p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={newConversation} disabled={busy} className={action({ variant: "soft", size: "sm" })}>
            <MessageSquarePlus aria-hidden strokeWidth={2.5} className="size-4" />
            Nueva conversación
          </button>
        )}
      </div>

      {showHelp && <HelpCard help={help} />}

      <div className="space-y-3" aria-live="polite">
        {ready && messages.length === 0 && (
          <div className="flex items-start gap-3 rounded-[22px] border border-dashed bg-card p-4 sm:p-5">
            <Kemo size={52} mood="normal" background={brand.lima} />
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cuéntale qué parte no entiendes o qué intentaste. También puedes empezar con una de estas:
              </p>
              <ul className="flex flex-wrap gap-2">
                {STARTERS.map((q) => (
                  <li key={q}>
                    <button type="button" onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="min-h-10 rounded-full bg-secondary px-3.5 py-2 text-left text-sm font-medium transition hover:bg-lima focus-visible:outline-2">
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          m.role === "assistant" ? (
            <div key={i} className="mr-2 flex items-end gap-2.5 sm:mr-12">
              <Kemo size={40} mood={m.content ? "normal" : "think"} background={brand.lima} />
              <div className="min-w-0 flex-1 space-y-2 rounded-[20px_20px_20px_6px] border bg-card p-4">
                {m.content ? <Markdown>{m.content}</Markdown> : <p className="text-sm text-muted-foreground">Pensando…</p>}
                {m.truncated && (
                  <p className="rounded-[12px] bg-secondary px-3 py-2 text-xs text-muted-foreground">
                    La respuesta se cortó porque era muy larga.{" "}
                    {i === messages.length - 1 && !busy && !full && (
                      <button type="button" onClick={() => ask("Continúa, por favor.")} className="font-semibold text-violeta underline underline-offset-2">
                        Pedirle que continúe
                      </button>
                    )}
                  </p>
                )}
                {m.id && <ReportButton targetType="tutor_message" targetId={m.id} />}
              </div>
            </div>
          ) : (
            <div key={i} className="ml-10 space-y-1.5 sm:ml-24">
              <div className="rounded-[20px_20px_6px_20px] bg-violeta px-[18px] py-3.5 text-white">
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

      {error && <p role="alert" className="rounded-[12px] bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">{error}</p>}

      {full ? (
        <Notice className="flex flex-wrap items-center justify-between gap-3">
          <span>Llegaste a los {limits.perSession} mensajes de esta conversación.</span>
          <button type="button" onClick={newConversation} className={action({ size: "md" })}>Empezar una nueva</button>
        </Notice>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); ask(input.trim()); }} className="space-y-1.5">
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="sr-only">Tu mensaje</span>
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={2} maxLength={2000} disabled={!ready}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                placeholder="Escribe tu pregunta…" className={textarea} />
            </label>
            <button disabled={busy || !input.trim() || !ready} aria-label="Enviar" className={`${action()} mb-px px-4`}>
              {busy ? "…" : <ArrowUp aria-hidden strokeWidth={2.5} className="size-5" />}
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
          <p className="flex flex-wrap justify-between gap-x-4 font-mono text-[11px] text-muted-foreground uppercase">
            <span>{used > 0 ? `${used} de ${limits.perSession} mensajes en esta conversación` : `Hasta ${limits.perDay} mensajes por día`}</span>
            <span className="hidden normal-case sm:inline">Enter para enviar · Shift + Enter para otra línea</span>
          </p>
        </form>
      )}
    </section>
  );
}
