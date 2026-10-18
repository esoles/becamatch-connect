import { createClient } from "@supabase/supabase-js";
import { makeAgentPlan, type AgentProfile } from "./postulation-agent";
import type { Database } from "@/integrations/supabase/types";

export async function readPlan(profile: AgentProfile) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) throw new Error("No se puede consultar el catálogo ahora.");
  const client = createClient<Database>(url, key, {
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
  const { data, error } = await client
    .from("scholarships")
    .select("*")
    .eq("verified", true)
    .eq("archived", false)
    .eq("es_demo", false)
    .eq("estado_datos", "verificada")
    .gt("deadline", new Date().toISOString().slice(0, 10));
  if (error) throw new Error("No se pudo consultar el catálogo de becas.");
  return makeAgentPlan(profile, data ?? [], new Date().toISOString().slice(0, 10));
}

