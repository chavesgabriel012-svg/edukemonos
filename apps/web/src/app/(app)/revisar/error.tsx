"use client";

export default function ReviewError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 p-4">
      <h2 className="font-semibold">Algo falló en la revisión</h2>
      <p className="text-sm text-muted-foreground">
        No se guardó nada nuevo. Si se repite, comparte este código: {error.digest ?? "sin código"}.
      </p>
      <button onClick={() => retry()} className="rounded-md border px-3 py-1 text-sm">
        Reintentar
      </button>
    </div>
  );
}
