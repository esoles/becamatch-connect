import type { Database } from "@/integrations/supabase/types";
export type AdminScholarship = Database["public"]["Tables"]["scholarships"]["Row"];
export function verificationLabel(
  s: Pick<AdminScholarship, "es_demo" | "verified" | "estado_datos">,
) {
  if (s.es_demo || s.estado_datos === "propuesta_ficticia_no_verificada")
    return "Datos de demostración";
  return s.verified && s.estado_datos === "verificada" ? "Verificada" : "Pendiente de verificación";
}
export function expiryLabel(deadline: string, today: string, archived = false) {
  if (archived) return "Archivada";
  const days = Math.round((Date.parse(deadline) - Date.parse(today)) / 86400000);
  return days <= 0 ? "Vencida" : days <= 30 ? "Próxima a vencer" : "Vigente";
}
export function canVerifyScholarship(
  s: Pick<AdminScholarship, "es_demo" | "estado_datos" | "official_url">,
) {
  return !s.es_demo && s.estado_datos !== "propuesta_ficticia_no_verificada" && !!s.official_url;
}
export function summaryMetrics(rows: AdminScholarship[], today: string) {
  const real = rows.filter(
    (s) => !s.es_demo && s.estado_datos !== "propuesta_ficticia_no_verificada",
  );
  return {
    total: real.length,
    demo: rows.length - real.length,
    verified: real.filter((s) => verificationLabel(s) === "Verificada").length,
    pending: real.filter((s) => verificationLabel(s) !== "Verificada").length,
    expiring: real.filter((s) => expiryLabel(s.deadline, today, s.archived) === "Próxima a vencer")
      .length,
  };
}
