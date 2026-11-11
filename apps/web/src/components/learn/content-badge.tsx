import { BadgeCheck, Sparkles } from "lucide-react";

/** "Generado con IA · …" (SPEC §4.4): every material and exercise shows its review state. */
export function ContentBadge({ reviewed }: { reviewed: boolean }) {
  const Icon = reviewed ? BadgeCheck : Sparkles;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${reviewed ? "bg-lima text-tinta" : "bg-secondary text-muted-foreground"}`}>
      <Icon aria-hidden strokeWidth={2.5} className="size-3.5" />
      Generado con IA · {reviewed ? "revisado por docente" : "pendiente de revisión"}
    </span>
  );
}
