import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listInteractions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data)
      throw new Error("Solo administradores pueden acceder a la bandeja.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { loadInteractions } = await import("./interaction-inbox.server");
    return JSON.stringify(await loadInteractions(db));
  });

export const updateInteractionAttention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        channel: z.enum(["Formulario", "Agente web"]),
        status: z.enum(["recibida", "en_atencion", "atendida"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data) throw new Error("Solo administradores.");
    const result =
      data.channel === "Formulario"
        ? await context.supabase
            .from("postulation_requests")
            .update({ attention_status: data.status, updated_at: new Date().toISOString() })
            .eq("id", data.id)
            .select("id")
            .single()
        : await context.supabase
            .from("web_agent_conversations")
            .update({ status: data.status, updated_at: new Date().toISOString() })
            .eq("id", data.id)
            .select("id")
            .single();
    if (result.error) throw new Error("No se pudo actualizar el estado de atención.");
    return { ok: true };
  });
