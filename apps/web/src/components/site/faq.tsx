import type { ReactNode } from "react";

export interface FaqItem {
  id: string;
  q: string;
  a: ReactNode;
}

/** Questions with their answers, plus an index at the top to jump to each one. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-6">
      <nav aria-label="En esta página" className="rounded-[22px] bg-card p-5">
        <p className="mb-2 font-mono text-xs text-muted-foreground uppercase">En esta página</p>
        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.id}>
              <a href={`#${i.id}`} className="text-sm font-medium underline-offset-2 hover:text-violeta hover:underline">{i.q}</a>
            </li>
          ))}
        </ul>
      </nav>
      {items.map((i) => (
        <section key={i.id} id={i.id} aria-labelledby={`${i.id}-q`} className="scroll-mt-6 space-y-3 rounded-[22px] border bg-card p-5 sm:p-6">
          <h2 id={`${i.id}-q`} className="font-heading text-2xl leading-tight font-bold">{i.q}</h2>
          <div className="space-y-3 leading-relaxed [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5">{i.a}</div>
        </section>
      ))}
    </div>
  );
}
