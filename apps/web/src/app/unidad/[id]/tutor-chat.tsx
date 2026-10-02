"use client";

import { useEffect, useRef, useState } from "react";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";
import { Markdown } from "@/components/learn/markdown";
import { ReportButton } from "@/components/learn/report-button";
import { openTutor, type TutorMessage } from "@/app/estudiar/actions";

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
}

const RISK = ["distress", "abuse"];

function HelpCard({ help }: { help: Help }) {
  return (
    <aside role="note" className="space-y-2 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950">
      <p className="font-semibold">No estás solo ni sola.</p>
      <p>{help.trustedAdultMessage}</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>{help.emergency.name}: {help.emergency.phone}</strong>. {help.emergency.description}</li>
        {help.resources.map((r) => (
          <li key={r.name}>{r.name}{r.phone ? `: ${r.phone}` : ""}{r.description ? `. ${r.description}` : ""}</li>
        ))}
      </ul>
    </aside>
  );
}

/** Chat with the Socratic tutor about one unit. Answers stream in as they are written. */
export function TutorChat({ unitId, help }: { unitId: string; help: Help }) {
  const [messages, setMessages] = useState<Shown[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

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

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    setMessages((m) => [...m, { id: null, role: "user", content: text, flags: [] }, { id: null, role: "assistant", content: "", flags: [] }]);
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
          const ev = JSON.parse(l) as { type: string; text?: string; sessionId?: string; messageId?: string; flags?: string[]; message?: string };
          if (ev.type === "session") {
            setSessionId(ev.sessionId ?? null);
            setMessages((m) => m.map((x, i) => (i === m.length - 2 ? { ...x, flags: ev.flags ?? [] } : x)));
          } else if (ev.type === "delta") {
            setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + (ev.text ?? "") } : x)));
          } else if (ev.type === "done") {
            setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, id: ev.messageId ?? null, flags: ev.flags ?? [] } : x)));
          } else if (ev.type === "error") {
            setError(ev.message ?? "El tutor no pudo responder.");
            setMessages((m) => (m.at(-1)?.content ? m : m.slice(0, -1)));
          }
        }
      }
    } catch {
      setError("Se perdió la conexión con el tutor. Intenta de nuevo.");
      setMessages((m) => (m.at(-1)?.content ? m : m.slice(0, -1)));
    } finally {
      setBusy(false);
    }
  }

  const showHelp = messages.some((m) => m.flags.some((f) => RISK.includes(f)));
  return (
    <section aria-labelledby="tutor-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="tutor-title" className="text-xl font-semibold">Pregúntale al tutor</h2>
        <p className="text-sm text-muted-foreground">
          Te guía paso a paso sobre esta unidad, con pistas antes que respuestas. Es una inteligencia artificial: puede
          equivocarse. No compartas datos personales.
        </p>
      </div>
      {showHelp && <HelpCard help={help} />}
      <div className="space-y-3" aria-live="polite">
        {ready && messages.length === 0 && (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Cuéntale qué parte no entiendes o qué intentaste. Por ejemplo: «No entiendo cuándo se usa la tilde en “él”» o «¿Por qué 2³ no es 6?».
          </p>
        )}
        {messages.map((m, i) => (
          m.role === "assistant" ? (
            <div key={i} className="mr-4 flex items-end gap-2.5">
              <Kemo size={40} mood={m.content ? "normal" : "think"} background={brand.lima} />
              <div className="min-w-0 flex-1 space-y-2 rounded-[20px_20px_20px_6px] border bg-card p-4">
                {m.content ? <Markdown>{m.content}</Markdown> : <p className="text-sm text-muted-foreground">Pensando…</p>}
                {m.id && <ReportButton targetType="tutor_message" targetId={m.id} />}
              </div>
            </div>
          ) : (
            <div key={i} className="ml-8 rounded-[20px_20px_6px_20px] bg-primary px-[18px] py-3.5 text-primary-foreground">
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          )
        ))}
        <div ref={bottom} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={send} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="sr-only">Tu mensaje</span>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} maxLength={2000} disabled={!ready}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
            placeholder="Escribe tu pregunta…" className="w-full rounded-md border bg-background px-3 py-2" />
        </label>
        <button disabled={busy || !input.trim() || !ready} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {busy ? "…" : "Enviar"}
        </button>
      </form>
    </section>
  );
}
