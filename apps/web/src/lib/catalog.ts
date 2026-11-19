import "server-only";
import { type Catalog, DEMO_CATALOG } from "@edukemonos/curriculum";
import { createClient } from "@/lib/supabase/server";

type CatalogRow = {
  institution_id: string | null;
  status: Catalog["status"];
  offerings: { grade_id: number; subject_id: string }[] | null;
  hidden_unit_ids: string[] | null;
};

/**
 * What the signed-in user's school offers. Without a session it is the
 * demo catalog: everything visible, no school. Anonymous student sessions count as signed in.
 * Throws if the RPC fails for a signed-in user.
 */
export async function myCatalog(): Promise<Catalog> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return DEMO_CATALOG;
  const { data, error } = await supabase.rpc("my_catalog");
  // A signed-in user must never fall back to the demo catalog: a school's student would see
  // units the school hides. Let the error boundary handle it.
  if (error || !data) throw new Error(`my_catalog failed: ${error?.message ?? "no data"}`);
  const row = data as CatalogRow;
  return {
    institutionId: row.institution_id ?? null,
    status: row.institution_id ? (row.status ?? null) : null,
    offerings: (row.offerings ?? []).map((o) => ({ gradeId: o.grade_id, subjectId: o.subject_id })),
    hiddenUnitIds: row.hidden_unit_ids ?? [],
  };
}
