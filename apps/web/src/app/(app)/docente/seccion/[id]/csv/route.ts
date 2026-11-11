import { computeSectionMetrics, sectionCsv } from "@edukemonos/curriculum";
import { createClient } from "@/lib/supabase/server";
import { audit, sectionSource } from "@/lib/teacher";

export async function GET(_request: Request, ctx: RouteContext<"/docente/seccion/[id]/csv">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.is_anonymous) return new Response("No autorizado", { status: 401 });
  const source = await sectionSource(supabase, id, data.user.id);
  if (!source) return new Response("No encontrado", { status: 404 });
  await audit(supabase, data.user.id, "export_csv", id);
  const slug = source.section.name.normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  return new Response(sectionCsv(computeSectionMetrics(source.data)), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="eduka-${slug || "seccion"}.csv"` },
  });
}
