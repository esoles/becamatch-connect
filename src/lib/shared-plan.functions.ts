import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setResponseHeader } from "@tanstack/react-start/server";
import { sharedPlanSchema } from "./shared-plan";

export const getSharedPlan = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    // The 122-bit share capability, not the sequential display number, authorizes this safe projection.
    const row = await db
      .from("web_agent_plans")
      .select("plan_number,shared_content,created_at")
      .eq("share_id", data.id)
      .not("shared_content", "is", null)
      .maybeSingle();
    if (row.error) throw new Error("No se pudo consultar el plan.");
    if (!row.data) return null;
    const parsed = sharedPlanSchema.safeParse(row.data.shared_content);
    if (!parsed.success) return null;
    return JSON.stringify({
      number: row.data.plan_number,
      createdAt: row.data.created_at,
      content: parsed.data,
      today: new Date().toISOString().slice(0, 10),
    });
  });
