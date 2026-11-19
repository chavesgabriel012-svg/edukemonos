"use client";

import { action } from "@/components/ui/action";

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className={action({ size: "md" })}>Imprimir</button>;
}
