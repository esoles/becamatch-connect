import { createFileRoute } from "@tanstack/react-router";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const twiml = (msg: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(msg)}</Message></Response>`, {
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Twilio WhatsApp incoming-message webhook. Caller is verified with a secret token in the URL.
export const Route = createFileRoute("/api/public/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["WHATSAPP_WEBHOOK_TOKEN"];
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        if (!expected) { console.error("whatsapp webhook: WHATSAPP_WEBHOOK_TOKEN not configured"); return new Response("Not configured", { status: 500 }); }
        if (!safeEqual(token.trim(), expected.trim())) { console.warn("whatsapp webhook: invalid token"); return new Response("Forbidden", { status: 403 }); }

        const form = await request.formData();
        // Normalize to E.164 ("+" may arrive decoded as a space).
        const digits = String(form.get("From") ?? "").replace(/^whatsapp:/, "").replace(/[^\d]/g, "");
        const from = digits ? `+${digits}` : "";
        const body = String(form.get("Body") ?? "").trim().slice(0, 1000);
        if (!/^\+\d{6,16}$/.test(from) || !body) return twiml("No pude leer tu mensaje.");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { handleIncoming } = await import("@/lib/whatsapp.server");
        try {
          const reply = await handleIncoming(supabaseAdmin, from, body, url.origin);
          return twiml(reply);
        } catch (e) {
          console.error("whatsapp webhook error", e);
          return twiml("Tuvimos un problema. Intenta de nuevo en unos minutos.");
        }
      },
    },
  },
});
