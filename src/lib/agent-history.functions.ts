import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { UIMessage } from "ai";
import type { AgentPlan } from "./postulation-agent";

export const resumeSchema = z.object({
  conversationId: z.string().uuid(),
  resumeToken: z.string().regex(/^[a-f0-9]{64}$/),
});
export const startAgentConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().max(5000).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { createConversation } = await import("./agent-history.server");
    return createConversation(data.accessToken);
  });
export const restoreAgentConversation = createServerFn({ method: "POST" })
  .inputValidator((d) => resumeSchema.parse(d))
  .handler(async ({ data }) => {
    const { openConversation } = await import("./agent-history.server");
    const { db } = await openConversation(data);
    const [messages, plans] = await Promise.all([
      db
        .from("web_agent_messages")
        .select("message")
        .eq("conversation_id", data.conversationId)
        .order("created_at"),
      db
        .from("web_agent_plans")
        .select("plan,plan_number,share_id,created_at")
        .eq("conversation_id", data.conversationId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (messages.error || plans.error) throw new Error("No se pudo recuperar la conversación.");
    return JSON.stringify({
      messages: (messages.data ?? []).map((r) => r.message as unknown as UIMessage),
      plan: plans.data?.[0]
        ? {
            ...(plans.data[0].plan as unknown as AgentPlan),
            planNumber: plans.data[0].plan_number,
            shareId: plans.data[0].share_id,
            shareUrl: plans.data[0].plan_number
              ? `https://becamatch-connect.lovable.app/plan/${plans.data[0].share_id}`
              : undefined,
            createdAt: plans.data[0].created_at,
          }
        : null,
    });
  });
