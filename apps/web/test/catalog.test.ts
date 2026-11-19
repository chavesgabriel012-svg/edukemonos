import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, rpc }) }));

import { DEMO_CATALOG } from "@edukemonos/curriculum";
import { myCatalog } from "@/lib/catalog";

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
});

describe("myCatalog", () => {
  it("is the demo catalog without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await myCatalog()).toEqual(DEMO_CATALOG);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps the RPC data to camelCase", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({
      data: { institution_id: "i1", status: "activo", offerings: [{ grade_id: 4, subject_id: "mat" }], hidden_unit_ids: ["x"] },
      error: null,
    });
    expect(await myCatalog()).toEqual({
      institutionId: "i1",
      status: "activo",
      offerings: [{ gradeId: 4, subjectId: "mat" }],
      hiddenUnitIds: ["x"],
    });
  });

  it("throws when the RPC fails for a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(myCatalog()).rejects.toThrow(/my_catalog failed/);
  });
});
