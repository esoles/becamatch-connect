import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const scholarshipsQuery = queryOptions({
  queryKey: ["scholarships"],
  queryFn: async () => {
    const { data, error } = await supabase.from("scholarships").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const PARENTAL_LABEL: Record<string, string> = {
  no_requerida: "No requerida",
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export type Decision = "guardada" | "descartada";

export const decisionsQuery = queryOptions({
  queryKey: ["decisions"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("scholarship_decisions")
      .select("scholarship_id, decision, created_at");
    if (error) throw error;
    return data as { scholarship_id: string; decision: Decision; created_at: string }[];
  },
});

/** One decision per user+scholarship (upsert on the unique pair). */
export async function setDecision(scholarshipId: string, decision: Decision) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sesión expirada");
  const { error } = await supabase
    .from("scholarship_decisions")
    .upsert(
      { user_id: u.user.id, scholarship_id: scholarshipId, decision, updated_at: new Date().toISOString() },
      { onConflict: "user_id,scholarship_id" },
    );
  if (error) throw error;
}

/** Removes the decision entirely: un-saving does NOT create a discard; recovering a discard returns it to the deck. */
export async function clearDecision(scholarshipId: string) {
  const { error } = await supabase.from("scholarship_decisions").delete().eq("scholarship_id", scholarshipId);
  if (error) throw error;
}

export function daysLeft(deadline: string, today = new Date().toISOString().slice(0, 10)) {
  return Math.round((Date.parse(deadline) - Date.parse(today)) / 86400000);
}

export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}
