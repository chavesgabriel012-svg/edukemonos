import Link from "next/link";
import { signOut } from "@/app/(app)/entrar/actions";

export default function ReviewLayout({ children }: LayoutProps<"/revisar">) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <Link href="/revisar" className="font-heading text-xl font-bold">
          Revisión del currículo
        </Link>
        <form action={signOut}>
          <button className="text-sm underline underline-offset-2">Salir</button>
        </form>
      </div>
      {children}
    </div>
  );
}
