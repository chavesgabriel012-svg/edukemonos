import { computeSectionMetrics, sectionCsv } from "@edukemonos/curriculum";
import { demoSource } from "@/lib/teacher";

export async function GET() {
  const source = await demoSource();
  return new Response(sectionCsv(computeSectionMetrics(source.data)), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="eduka-demostracion.csv"' },
  });
}
