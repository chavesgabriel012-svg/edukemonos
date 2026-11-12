import type { Metadata } from "next";
import { action } from "@/components/ui/action";
import { Notice } from "@/components/ui/notice";
import { card, field } from "@/components/ui/styles";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  correo: "Revise el correo: no parece una dirección válida.",
  envio: "No pudimos enviar el enlace. Intente de nuevo en unos minutos.",
  enlace: "El enlace no es válido o ya venció. Pida uno nuevo.",
};

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/docente";
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const sent = params.enviado === "1";

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl leading-none font-bold">Entrar como docente o revisor</h1>
        <p className="text-muted-foreground">
          Le enviaremos un enlace a su correo para entrar, sin contraseña. Los estudiantes no necesitan cuenta.
        </p>
      </div>
      {sent ? (
        <Notice role="status" className="text-base">
          Listo. Abra el enlace que le enviamos al correo desde este mismo navegador.
        </Notice>
      ) : (
        <form action={sendMagicLink} className={`${card} space-y-5`}>
          <input type="hidden" name="next" value={next} />
          <label className="block space-y-1.5">
            <span className="font-semibold">Correo electrónico</span>
            <input name="email" type="email" required autoComplete="email" placeholder="nombre@ejemplo.com" className={field} />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" className={`${action()} w-full`}>
            Enviarme el enlace
          </button>
        </form>
      )}
    </section>
  );
}
