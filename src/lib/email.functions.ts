import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const sendTestNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scholarshipId: z.string().uuid(), appUrl: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string }).email;
    if (!email) return { ok: false as const, error: "Tu cuenta no tiene email." };
    const { data: dec } = await supabase.from("scholarship_decisions").select("decision")
      .eq("user_id", userId).eq("scholarship_id", data.scholarshipId).maybeSingle();
    if (dec?.decision !== "guardada") return { ok: false as const, error: "Solo puedes enviar avisos de becas guardadas." };
    const { data: s } = await supabase.from("scholarships").select("name, deadline").eq("id", data.scholarshipId).maybeSingle();
    if (!s) return { ok: false as const, error: "Beca no encontrada." };

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) return { ok: false as const, error: "El correo no está configurado." };
    const link = `${data.appUrl.replace(/\/$/, "")}/beca/${data.scholarshipId}`;
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY },
      body: JSON.stringify({
        from: "BecaMatch <onboarding@resend.dev>",
        to: [email],
        subject: `Aviso de prueba: ${s.name}`,
        html: `<h2>${esc(s.name)}</h2><p>Fecha límite: <b>${esc(s.deadline)}</b></p><p><a href="${esc(link)}">Ver en BecaMatch</a></p><p style="color:#888">Aviso de prueba · Datos de demostración</p>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      return { ok: false as const, error: `No se pudo enviar (${res.status}): ${body.slice(0, 200)}` };
    }
    return { ok: true as const, to: email };
  });
