import type { Metadata } from "next";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Únete a tu sección" };

export default function JoinPage() {
  return (
    <section className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Únete a tu sección</h1>
        <p className="text-muted-foreground">
          Si tu docente te dio un código, escríbelo aquí junto con tu nombre. Así tu docente podrá ver tu avance y ayudarte mejor.
        </p>
      </div>
      <JoinForm />
    </section>
  );
}
