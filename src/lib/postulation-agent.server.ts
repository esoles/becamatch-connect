import { createClient } from "@supabase/supabase-js";
import { makeAgentPlan, type AgentProfile, type AgentPlanOptions } from "./postulation-agent";
import type { Database } from "@/integrations/supabase/types";
import { matchScholarshipNames } from "./scholarship-name";
import { scholarshipFactsBlock } from "./assistant.server";

function publicCatalogClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("No se puede consultar el catálogo ahora.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function lookupScholarship(name: string) {
  const client = publicCatalogClient();
  const { data, error } = await client.from("scholarships")
    .select("id,name,entity,country,deadline,study_level,area,coverage,requirements,documents,official_url,min_gpa,language_code,language_level,es_demo,requisitos_detallados,documentos_requeridos,proceso_postulacion,restricciones,preguntas_frecuentes,fuente_requisitos,ultima_verificacion,estado_datos,aviso_datos,archived");
  if (error) throw new Error("No se pudo consultar el catálogo de becas.");
  const matches = matchScholarshipNames(data ?? [], name);
  if (!matches.length) return { status: "not_found", message: "No hay una beca registrada con ese nombre. Solicita el nombre exacto; no inventes información." };
  if (matches.length > 1) return {
    status: "ambiguous", total: matches.length,
    candidates: matches.slice(0, 5).map(({ id, name, entity, country }) => ({ id, name, entity, country })),
    message: "Solicita que el visitante elija el nombre exacto antes de responder sobre requisitos o fechas.",
  };
  const scholarship = matches[0];
  if (!scholarship) throw new Error("No se pudo identificar la beca.");
  const today = new Date().toISOString().slice(0, 10);
  return {
    status: "found", id: scholarship.id, name: scholarship.name,
    facts: scholarshipFactsBlock(scholarship),
    today, deadlinePassed: scholarship.deadline < today, archived: scholarship.archived,
    applicationOpeningDate: null,
    notice: "La fecha registrada es la fecha límite, no la fecha de apertura ni una postulación realizada. La fecha de apertura no está registrada. Una consulta informativa no genera un plan ni verifica una beca.",
  };
}

export async function readPlan(profile: AgentProfile, options: AgentPlanOptions = { mode: "real", scholarshipName: null }) {
  const client = publicCatalogClient();
  let query = client
    .from("scholarships")
    .select("*")
    .eq("verified", true)
    .eq("archived", false)
    .eq("es_demo", options.mode === "demo")
    .gt("deadline", new Date().toISOString().slice(0, 10));
  if (options.mode === "real") query = query.eq("estado_datos", "verificada");
  const { data, error } = await query;
  if (error) throw new Error("No se pudo consultar el catálogo de becas.");
  if (options.mode === "demo" && !options.scholarshipName) throw new Error("Elige la beca para tu plan de demostración.");
  const catalog = options.scholarshipName ? matchScholarshipNames(data ?? [], options.scholarshipName) : data ?? [];
  if (options.scholarshipName && catalog.length !== 1) throw new Error("Indica el nombre exacto de una beca habilitada y vigente.");
  return makeAgentPlan(profile, catalog, new Date().toISOString().slice(0, 10), options);
}
