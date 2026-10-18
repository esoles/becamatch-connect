import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { agentProfileSchema, makeAgentPlan } from "./postulation-agent";
import type { Database } from "@/integrations/supabase/types";

async function readPlan(profile: z.infer<typeof agentProfileSchema>) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("No se puede consultar el catálogo ahora.");
  const client = createClient<Database>(url, key, { auth: { persistSession: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
  const { data, error } = await client.from("scholarships").select("*").eq("verified", true).eq("archived", false).eq("es_demo", false).eq("estado_datos", "verificada").gt("deadline", new Date().toISOString().slice(0, 10));
  if (error) throw new Error("No se pudo consultar el catálogo de becas.");
  return makeAgentPlan(profile, data ?? [], new Date().toISOString().slice(0, 10));
}

export const generateAgentPlan = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ profile: agentProfileSchema, confirmed: z.literal(true) }).parse(input))
  .handler(async ({ data }) => readPlan(data.profile));

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
export const emailAgentPlan = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ profile: agentProfileSchema, email: z.string().email().max(200), requested: z.literal(true) }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"], resend = process.env["RESEND_API_KEY"];
    if (!key || !resend) return { ok: false, error: "El envío de correo no está configurado." };
    const plan = await readPlan(data.profile);
    const text = ["Tu plan de postulación — BecaMatch", JSON.stringify(plan.profile), plan.notice,
      ...plan.opportunities.map((s) => `${s.name} (${s.entity}, ${s.country})\nCompatibilidad: ${s.score}/100. ${s.reasons}\nFecha límite: ${s.deadline}\n${s.requirements ?? "Requisitos no registrados"}\n${s.legacyDocuments ?? ""}\n${s.orientation.documents.map((d) => `${d.nombre}: ${d.obligatorio ? "obligatorio" : "opcional"}`).join("\n")}\n${s.pending}\n${s.url ?? "Enlace no registrado"}`), ...plan.steps].join("\n\n");
    const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Connection-Api-Key": resend }, body: JSON.stringify({ from: "BecaMatch <onboarding@resend.dev>", to: [data.email], subject: "Tu plan de postulación — BecaMatch", html: `<pre style="white-space:pre-wrap;font-family:Arial">${escapeHtml(text)}</pre>` }) });
    if (!response.ok) return { ok: false, error: "No se pudo enviar el correo. El remitente de prueba solo permite destinatarios autorizados; para enviar a cualquier estudiante falta verificar un dominio de correo." };
    return { ok: true };
  });