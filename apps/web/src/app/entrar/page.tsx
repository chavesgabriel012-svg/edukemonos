import type { Metadata } from "next";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  correo: "Revisa el correo: no parece una dirección válida.",
  envio: "No pudimos enviar el enlace. Intenta de nuevo en unos minutos.",
  enlace: "El enlace no es válido o ya venció. Pide uno nuevo.",
};

export default async function SignInPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/revisar";
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const sent = params.enviado === "1";

  return (
    <section className="mx-auto max-w-sm space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Entrar como docente o revisor</h1>
        <p className="text-sm text-muted-foreground">
          Te enviamos un enlace a tu correo. Los estudiantes no necesitan cuenta.
        </p>
      </div>
      {sent ? (
        <p role="status" className="rounded-lg border border-primary/30 bg-secondary p-4 text-sm">
          Listo. Abre el enlace que te enviamos al correo desde este mismo navegador.
        </p>
      ) : (
        <form action={sendMagicLink} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Correo electrónico</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
            Enviarme el enlace
          </button>
        </form>
      )}
    </section>
  );
}
