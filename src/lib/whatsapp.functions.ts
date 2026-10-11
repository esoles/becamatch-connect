import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/), confirm: z.boolean() });

/** Links the WhatsApp number behind a one-time token to the signed-in user and completes the pending save. */
export const linkWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: sess } = await db.from("whatsapp_sessions").select("*").eq("link_token", data.token).maybeSingle();
    if (!sess || !sess.link_token_expires_at || new Date(sess.link_token_expires_at) < new Date())
      return { ok: false as const, error: "El enlace no es válido o expiró. Escribe GUARDAR otra vez en WhatsApp." };
    const { data: sch } = sess.pending_scholarship_id
      ? await db.from("scholarships").select("id, name").eq("id", sess.pending_scholarship_id).maybeSingle()
      : { data: null };
    const masked = sess.phone.replace(/.(?=.{3})/g, "•");
    if (!data.confirm) return { ok: true as const, done: false, phone: masked, scholarship: sch?.name ?? null };

    if (sch && sess.pending_action === "guardar") {
      const { error } = await db.from("scholarship_decisions").upsert(
        { user_id: context.userId, scholarship_id: sch.id, decision: "guardada", updated_at: new Date().toISOString() },
        { onConflict: "user_id,scholarship_id" });
      if (error) return { ok: false as const, error: "No se pudo guardar la beca." };
    }
    await db.from("whatsapp_sessions").update({
      user_id: context.userId, pending_action: null, pending_scholarship_id: null, current_scholarship_id: null,
      link_token: null, link_token_expires_at: null, updated_at: new Date().toISOString(),
    }).eq("phone", sess.phone);
    await db.from("whatsapp_messages").insert({
      phone: sess.phone, direction: "sistema", body: "Número vinculado a la cuenta desde la web",
      scholarship_id: sch?.id ?? null, action: "vincular", result: sch ? "vinculado_y_guardada" : "vinculado", user_id: context.userId,
    });
    return { ok: true as const, done: true, phone: masked, scholarship: sch?.name ?? null };
  });
