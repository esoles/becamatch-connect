import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { buildSystemPrompt, callAssistantAi } from "./assistant.server";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let sch: any = null;
    if (data.scholarshipId) {
      const { data: row } = await context.supabase
        .from("scholarships")
        .select("name, entity, country, deadline, area, study_level, coverage, requirements, documents, official_url, min_gpa, language_code, language_level, es_demo")
        .eq("id", data.scholarshipId)
        .maybeSingle();
      sch = row;
    }

    const system = buildSystemPrompt({ scholarship: sch, channel: "web" });
    return callAssistantAi(system, data.messages);
  });
