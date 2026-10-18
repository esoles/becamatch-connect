import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildSystemPrompt, callAssistantAi } from "./assistant.server";
import type { ScholarshipFacts } from "./assistant.server";
import { withOrientationWarning } from "./scholarship-orientation";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(1000),
});

const Input = z.object({
  scholarshipId: z.string().uuid().nullable(),
  messages: z.array(Message).min(1).max(40),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    let sch: ScholarshipFacts | null = null;
    if (data.scholarshipId) {
      const { data: row } = await context.supabase
        .from("scholarships")
        .select("*")
        .eq("id", data.scholarshipId)
        .maybeSingle();
      sch = row;
    }

    const system = buildSystemPrompt({ scholarship: sch, channel: "web" });
    const result = await callAssistantAi(system, data.messages);
    return result.ok && sch ? { ...result, reply: withOrientationWarning(result.reply, sch) } : result;
  });
