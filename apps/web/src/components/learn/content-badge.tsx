/** "Generado con IA · …" (SPEC §4.4): every material and exercise shows its review state. */
export function ContentBadge({ reviewed }: { reviewed: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      Generado con IA · {reviewed ? "revisado por docente" : "pendiente de revisión"}
    </span>
  );
}
