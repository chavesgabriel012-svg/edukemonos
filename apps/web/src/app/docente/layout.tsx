import Link from "next/link";
import { signOut } from "@/app/entrar/actions";
import { createClient } from "@/lib/supabase/server";

export default async function TeacherLayout({ children }: LayoutProps<"/docente">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const staff = data.user && !data.user.is_anonymous;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <Link href="/docente" className="font-heading text-xl font-bold">Panel docente</Link>
        <nav aria-label="Panel docente" className="flex flex-wrap items-center gap-1 text-sm">
          {staff && <Link href="/docente" className="rounded-[10px] px-3 py-2 font-medium hover:bg-secondary">Mis secciones</Link>}
          <Link href="/docente/demo" className="rounded-[10px] px-3 py-2 font-medium hover:bg-secondary">Demostración</Link>
          {staff ? (
            <form action={signOut}><button className="rounded-[10px] px-3 py-2 font-medium hover:bg-secondary">Salir</button></form>
          ) : (
            <Link href="/entrar?next=/docente" className="rounded-[10px] px-3 py-2 font-medium hover:bg-secondary">Entrar</Link>
          )}
        </nav>
      </div>
      {children}
    </div>
  );
}
