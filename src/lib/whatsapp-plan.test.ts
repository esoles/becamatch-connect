import { describe, it, expect, vi } from "vitest";
const saved = vi.hoisted(() =>
  vi.fn(async () => ({
    planNumber: "BM-2026-0004",
    shareId: "5fbfca29-371b-466d-a267-de971ec67a51",
    notice: "Missing verified scholarship",
  })),
);
vi.mock("./shared-plan.server", () => ({
  verifiedCatalog: async () => [],
  planForSelection: () => ({ opportunities: [] }),
  saveSharedPlan: saved,
}));
import { handleIncoming } from "./whatsapp.server";
describe("WhatsApp plan reply through existing webhook", () => {
  it("relates the plan to the real incoming record without claiming delivery", async () => {
    const inserts: { table: string; value: Record<string, unknown> }[] = [];
    const db = {
      from: (table: string) => {
        const chain: Record<string, unknown> = {};
        chain["select"] = () => chain;
        chain["eq"] = () => chain;
        chain["maybeSingle"] = async () => ({
          data: table === "whatsapp_sessions" ? { user_id: null } : null,
          error: null,
        });
        chain["single"] = async () => ({ data: { id: "real-incoming-record" }, error: null });
        chain["insert"] = (value: Record<string, unknown>) => {
          inserts.push({ table, value });
          return chain;
        };
        chain["then"] = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
        return chain;
      },
    };
    const result = await handleIncoming(
      db as unknown as Parameters<typeof handleIncoming>[0],
      "confirmed-phone",
      "Quiero un plan para postular",
      "https://becamatch-connect.lovable.app",
    );
    expect(result).toContain("/plan/5fbfca29-371b-466d-a267-de971ec67a51");
    expect(saved).toHaveBeenCalledWith(
      db,
      { opportunities: [] },
      { whatsappMessageId: "real-incoming-record", userId: null },
    );
    expect(inserts.at(-1)?.value["result"]).toBe("respuesta_preparada");
    expect(inserts.filter((i) => i.value["direction"] === "entrante")).toHaveLength(1);
    expect(result).not.toMatch(/entregado|enviado|obtenida/);
  });
});
