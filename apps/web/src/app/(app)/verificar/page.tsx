import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { action } from "@/components/ui/action";
import { card, field } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Verificar un certificado", description: "Compruebe un certificado de dominio de Eduka con su código." };

async function go(form: FormData) {
  "use server";
  const code = String(form.get("code") ?? "").toUpperCase().replace(/[^0-9A-F]/g, "");
  redirect(`/verificar/${code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code || "-"}`);
}

export default function VerifyPage() {
  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl leading-none font-bold">Verificar un certificado</h1>
        <p className="text-muted-foreground">Escriba el código que aparece al pie del certificado. La respuesta dice qué tema se dominó y cuándo, nunca quién.</p>
      </div>
      <form action={go} className={`${card} space-y-4`}>
        <label className="block space-y-1.5">
          <span className="font-semibold">Código</span>
          <input name="code" required autoComplete="off" placeholder="7F3A2-9C01B" className={`${field} font-mono tracking-[0.2em] uppercase`} />
        </label>
        <button className={`${action()} w-full`}>Verificar</button>
      </form>
    </section>
  );
}
