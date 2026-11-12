import type { Metadata } from "next";
import { card } from "@/components/ui/styles";
import { createClient } from "@/lib/supabase/server";
import { CreateCodeForm, RedeemCodeForm } from "./forms";

export const metadata: Metadata = { title: "Tu código de recuperación" };

export default async function RecoveryCodePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const student = auth.user?.is_anonymous ? auth.user : null;
  const { data: hasCode } = student ? await supabase.rpc("has_recovery_code") : { data: false };

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Tu código de recuperación</h1>
        <p className="text-muted-foreground">
          Tu progreso se guarda en este dispositivo. Con un código personal puedes llevarlo a otro celular o computadora,
          sin correo ni contraseña.
        </p>
      </div>

      <div className={`${card} space-y-3`}>
        <h2 className="font-heading text-2xl font-bold">Guarda tu progreso</h2>
        {student ? (
          <CreateCodeForm hasCode={Boolean(hasCode)} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no tienes progreso en este dispositivo. Cuando resuelvas tu primer ejercicio, vuelve aquí para crear tu código.
          </p>
        )}
      </div>

      <div className={`${card} space-y-3`}>
        <h2 className="font-heading text-2xl font-bold">¿Cambiaste de dispositivo?</h2>
        <p className="text-sm text-muted-foreground">Escribe el código que guardaste y traemos tu progreso aquí.</p>
        <RedeemCodeForm />
      </div>
    </section>
  );
}
