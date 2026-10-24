import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { agentProfileSchema, agentPlanOptionsSchema } from "./postulation-agent";
import { readPlan } from "./postulation-agent.server";
import { resumeSchema } from "./agent-history.functions";

export const generateAgentPlan = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    resumeSchema.extend({ profile: agentProfileSchema, confirmed: z.literal(true), options: agentPlanOptionsSchema.optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { openConversation } = await import("./agent-history.server");
    const { db, conversation } = await openConversation(data);
    const plan = await readPlan(data.profile, data.options);
    const { saveSharedPlan } = await import("./shared-plan.server");
    const saved = await saveSharedPlan(db, plan, {
      conversationId: data.conversationId,
      userId: conversation.user_id,
    });
    const updated = await db
      .from("web_agent_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    if (updated.error) throw new Error("No se pudo actualizar la conversación.");
    return saved;
  });

export const emailAgentPlan = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    resumeSchema
      .extend({
        shareId: z.string().uuid(),
        email: z.string().email().max(200),
        requested: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { openConversation } = await import("./agent-history.server");
    const { db } = await openConversation(data);
    const owned = await db
      .from("web_agent_plans")
      .select("id")
      .eq("share_id", data.shareId)
      .eq("conversation_id", data.conversationId)
      .maybeSingle();
    if (owned.error || !owned.data) throw new Error("El plan no pertenece a esta conversación.");
    const { sendStoredPlanEmail } = await import("./shared-plan.server");
    return sendStoredPlanEmail(db, data.shareId, data.email);
  });
