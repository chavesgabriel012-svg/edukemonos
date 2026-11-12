"use client";

import { useEffect, useRef, useState } from "react";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";

/** `at`: when the bubble appears (s). Kemo's bubbles show the typing dots until `text` (s). */
const CHAT: { from: "student" | "kemo"; text: string; at: number; textAt?: number }[] = [
  { from: "student", text: "No sé cómo empezar 3 + 4 × 2", at: 0.4 },
  { from: "kemo", text: "Vamos paso a paso. Antes de calcular: ¿qué operación crees que va primero, la suma o la multiplicación?", at: 1.3, textAt: 2.7 },
  { from: "student", text: "¿La multiplicación?", at: 4.3 },
  { from: "kemo", text: "¡Eso! La multiplicación va primero. Entonces, ¿cuánto te da 4 × 2?", at: 5.2, textAt: 6.5 },
];
const TYPING: [number, number][] = CHAT.flatMap((m) => (m.textAt ? [[m.at * 1000, m.textAt * 1000] as [number, number]] : []));

/**
 * A short Socratic exchange that plays once when it comes on screen: the student asks, Kemo
 * «types» and answers with a question. The bubbles keep their final size from the start, so
 * nothing moves around. With «reduce motion» or without JavaScript the whole chat is simply there.
 */
export function ChatPreview() {
  const ref = useRef<HTMLElement>(null);
  const [play, setPlay] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      const t = setTimeout(() => setPlay(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPlay(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Kemo looks up (thinking) while the dots are showing.
  useEffect(() => {
    if (!play || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers = TYPING.flatMap(([from, to]) => [setTimeout(() => setTyping(true), from), setTimeout(() => setTyping(false), to)]);
    return () => timers.forEach(clearTimeout);
  }, [play]);

  return (
    <figure ref={ref} data-play={play ? "" : undefined}
      className="w-full max-w-md rounded-[28px] bg-papel p-4 text-tinta shadow-[0_32px_64px_-24px_rgba(23,19,42,0.55)] sm:p-5">
      <noscript><style>{".chat-bubble,.chat-text{animation:none}.chat-dots{display:none}"}</style></noscript>
      <figcaption className="mb-3 flex items-center gap-2.5">
        <Kemo size={34} mood={typing ? "think" : "normal"} background={brand.lima} />
        <span className="font-heading text-lg font-bold">Kemo</span>
      </figcaption>
      <ol className="space-y-2.5 text-[15px] leading-snug">
        {CHAT.map((m, i) =>
          m.from === "student" ? (
            <li key={i} style={{ "--d": `${m.at}s` } as React.CSSProperties}
              className="chat-bubble ml-10 origin-bottom-right rounded-[18px_18px_6px_18px] bg-violeta px-4 py-3 text-white">
              {m.text}
            </li>
          ) : (
            <li key={i} style={{ "--d": `${m.at}s`, "--t": `${m.textAt}s` } as React.CSSProperties}
              className="chat-bubble relative mr-6 origin-bottom-left rounded-[18px_18px_18px_6px] border bg-card px-4 py-3">
              <span aria-hidden className="chat-dots absolute top-4 left-4 flex gap-1">
                <i className="size-2 rounded-full bg-tinta/50" />
                <i className="size-2 rounded-full bg-tinta/50" />
                <i className="size-2 rounded-full bg-tinta/50" />
              </span>
              <span className="chat-text block">{m.text}</span>
            </li>
          ),
        )}
      </ol>
    </figure>
  );
}
