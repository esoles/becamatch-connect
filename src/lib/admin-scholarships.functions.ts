import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { canVerifyScholarship } from "./admin-scholarships";

const fields = z.object({
  name: z.string().trim().min(2).max(240), entity: z.string().trim().min(2).max(240), country: z.string().trim().min(2).max(100),
  study_level: z.string().max(120).nullable(), area: z.string().max(240).nullable(), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)), "Fecha no válida"),
  official_url: z.string().url().refine(v => /^https?:\/\//.test(v)).nullable(),
  requirements: z.string().max(10000).nullable(), documents: z.string().max(10000).nullable(), coverage: z.string().max(5000).nullable(),
  language_code: z.string().max(20).nullable(), language_level: z.string().max(20).nullable(), min_gpa: z.number().min(0).max(20).nullable(),
  archived: z.boolean(),
});
export const saveAdminScholarship = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid().nullable(), fields }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Solo administradores autorizados pueden gestionar becas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const existing = await supabaseAdmin.from("scholarships").select("es_demo, estado_datos").eq("id", data.id).single();
      if (existing.error) throw new Error("No se encontró la beca.");
      const verification = existing.data.es_demo || existing.data.estado_datos === "propuesta_ficticia_no_verificada" ? {} : { verified: false, estado_datos: "pendiente_verificacion", ultima_verificacion: null };
      const result = await supabaseAdmin.from("scholarships").update({ ...data.fields, ...verification }).eq("id", data.id).select("id").single();
      if (result.error) throw new Error("No se pudo guardar la beca.");
      return result.data;
    }
    const result = await supabaseAdmin.from("scholarships").insert({ ...data.fields, es_demo: false, verified: false, estado_datos: "pendiente_verificacion" }).select("id").single();
    if (result.error) throw new Error("No se pudo crear la beca.");
    return result.data;
  });

export const verifyAdminScholarship = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), checked: z.literal(true), source: z.string().url().refine(v => /^https?:\/\//.test(v)) }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Solo administradores autorizados pueden verificar becas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await supabaseAdmin.from("scholarships").select("es_demo, estado_datos, official_url").eq("id", data.id).single();
    if (existing.error || !canVerifyScholarship(existing.data)) throw new Error("Los ejemplos ficticios no pueden verificarse como convocatorias reales. Se requiere un enlace oficial.");
    const result = await supabaseAdmin.from("scholarships").update({ verified: true, estado_datos: "verificada", fuente_requisitos: data.source, ultima_verificacion: new Date().toISOString().slice(0, 10) }).eq("id", data.id);
    if (result.error) throw new Error("No se pudo registrar la verificación.");
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("Solo administradores autorizados.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [profiles, requests, recent] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("postulation_requests").select("id", { count: "exact", head: true }).in("status", ["recibida", "analizada", "error"]),
    supabaseAdmin.from("postulation_requests").select("id, full_name, status, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  if (profiles.error || requests.error || recent.error) throw new Error("No se pudo cargar el resumen operativo.");
  return { registered: profiles.count ?? 0, pendingRequests: requests.count ?? 0, recentRequests: recent.data ?? [] };
});