import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { action } from "@/components/ui/action";
import { eyebrow } from "@/components/ui/styles";
import { studentSectionTournament } from "@/lib/sections";
import { TournamentPlayer } from "./play";

export const metadata: Metadata = { title: "Torneo de los viernes" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TournamentPage({ params }: PageProps<"/mis-secciones/[id]/torneo">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const found = await studentSectionTournament(id);
  if (!found) notFound();
  const { name, tournament } = found;
  const t = tournament.tournament ?? null;
  const open = tournament.enabled && tournament.status === "open" && t;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <BackLink href="/mis-secciones">Mis secciones</BackLink>
        <p className={eyebrow}>{name}</p>
        <h1 className="font-heading text-4xl leading-none font-bold sm:text-5xl">Torneo de los viernes</h1>
        {open && t.me && <p className="text-muted-foreground">Juegas con el {t.me.team}. Cada acierto y cada habilidad que domines suman a tu equipo.</p>}
      </div>
      {open ? (
        <TournamentPlayer tournamentId={t.id} backHref="/mis-secciones" />
      ) : (
        <div className="space-y-4 rounded-[22px] border bg-card p-5">
          <p>
            {!tournament.enabled
              ? "Tu docente no usa el torneo en esta sección."
              : tournament.status === "none"
                ? "Esta semana no hay torneo en tu sección."
                : "El torneo está cerrado. El próximo abre el viernes."}
          </p>
          <Link href="/mis-secciones" className={action({ size: "md" })}>Volver a mis secciones</Link>
        </div>
      )}
    </section>
  );
}
