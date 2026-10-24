import type { UIMessage } from "ai";
import { consentSchema } from "./privacy";
import type { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

export type ResumeCredential = { conversationId: string; resumeToken: string };
async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function verifiedIdentity(accessToken?: string) {
  if (!accessToken) return null;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db.auth.getUser(accessToken);
  return !error && data.user?.email_confirmed_at ? data.user.id : null;
}
export async function openConversation(credential: ResumeCredential) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db
    .from("web_agent_conversations")
    .select("id,user_id,status")
    .eq("id", credential.conversationId)
    .eq("resume_token_hash", await hash(credential.resumeToken))
    .maybeSingle();
  if (error || !data) throw new Error("No se puede acceder a esta conversación.");
  return { db, conversation: data };
}
export async function createConversation(accessToken: string | undefined, consent: z.infer<typeof consentSchema>) {
  consentSchema.parse(consent);
  const resumeToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db
    .from("web_agent_conversations")
    .insert({
      resume_token_hash: await hash(resumeToken),
      user_id: await verifiedIdentity(accessToken),
      privacy_version: consent.policyVersion, privacy_accepted: consent.legal,
      promotions_email: consent.emailPromotions, promotions_whatsapp: consent.whatsappPromotions,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo guardar la conversación.");
  return { conversationId: data.id, resumeToken };
}
export async function appendMessages(credential: ResumeCredential, messages: UIMessage[]) {
  const { db } = await openConversation(credential);
  if (!messages.length) return;
  const { error } = await db.from("web_agent_messages").upsert(
    messages.map((message) => ({
      conversation_id: credential.conversationId,
      sdk_message_id: message.id,
      message: message as unknown as Json,
    })),
    { onConflict: "conversation_id,sdk_message_id", ignoreDuplicates: true },
  );
  if (error) throw new Error("No se pudieron guardar los mensajes.");
  const updated = await db
    .from("web_agent_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", credential.conversationId);
  if (updated.error) throw new Error("No se pudo actualizar la conversación.");
}
