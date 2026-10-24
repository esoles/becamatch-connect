import { z } from "zod";
import { buildDeck, explain, type CompatProfile, type CompatScholarship } from "./compatibility";
import { orientationData, type OrientationFields } from "./scholarship-orientation";
import { LANGUAGES } from "./catalog";

export const agentProfileSchema = z.object({
  name: z.string(),
  residence: z.string(),
  nationality: z.string(),
  currentLevel: z.string(),
  desiredLevel: z.string(),
  area: z.string(),
  gpa: z.number().nullable(),
  gpaScale: z.number().nullable(),
  languages: z.array(
    z.object({ code: z.string(), level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]) }),
  ),
  countries: z.array(z.string()),
  startYear: z.number().nullable(),
  funding: z.string(),
});
export type AgentProfile = z.infer<typeof agentProfileSchema>;
export const profileLabels: Record<keyof AgentProfile, string> = {
  name: "Nombre",
  residence: "Residencia",
  nationality: "Nacionalidad",
  currentLevel: "Nivel actual",
  desiredLevel: "Nivel deseado",
  area: "Área",
  gpa: "Promedio",
  gpaScale: "Escala",
  languages: "Idiomas",
  countries: "Países de interés",
  startYear: "Año de inicio",
  funding: "Financiamiento",
};
export type PlanScholarship = CompatScholarship &
  OrientationFields & {
    entity: string;
    coverage: string | null;
    requirements: string | null;
    documents: string | null;
    official_url: string | null;
  };

export const agentPlanOptionsSchema = z.object({
  mode: z.enum(["real", "demo"]),
  scholarshipName: z.string().min(1).max(200).nullable(),
});
export type AgentPlanOptions = z.infer<typeof agentPlanOptionsSchema>;

export function makeAgentPlan(profile: AgentProfile, catalog: PlanScholarship[], today: string, options: AgentPlanOptions = { mode: "real", scholarshipName: null }) {
  const validGpa =
    profile.gpa !== null &&
    profile.gpaScale !== null &&
    profile.gpaScale > 0 &&
    profile.gpa >= 0 &&
    profile.gpa <= profile.gpaScale;
  const compatible: CompatProfile = {
    study_level: profile.desiredLevel,
    area: profile.area,
    countries: profile.countries,
    languages: profile.languages,
    gpa: validGpa ? (Number(profile.gpa) / Number(profile.gpaScale)) * 20 : 0,
  };
  const demo = options.mode === "demo";
  const real = catalog.filter((s) => demo ? s.es_demo === true : !s.es_demo && s.estado_datos === "verificada");
  // Normalize recorded language names at the catalog boundary, without changing scoring rules or stored facts.
  const normalized = real.map((s) => ({ ...s, language_code: LANGUAGES.find((l) => l.name.toLowerCase() === s.language_code?.toLowerCase())?.code ?? s.language_code }));
  const deck = buildDeck(compatible, normalized, today);
  const opportunities = validGpa
    ? deck.eligible
        .filter((r) => r.compatibility_score >= 50)
        .slice(0, 3)
        .map((r) => ({
          id: r.scholarship.id,
          name: r.scholarship.name,
          entity: r.scholarship.entity,
          country: r.scholarship.country,
          studyLevel: r.scholarship.study_level,
          area: r.scholarship.area,
          language: r.scholarship.language_code
            ? `${r.scholarship.language_code} ${r.scholarship.language_level ?? ""}`.trim()
            : null,
          deadline: r.scholarship.deadline,
          url: r.scholarship.official_url,
          coverage: r.scholarship.coverage,
          score: r.compatibility_score as number | null,
          reasons: explain(r.components),
          requirements: r.scholarship.requirements,
          legacyDocuments: r.scholarship.documents,
          orientation: orientationData(r.scholarship),
          pending:
            demo ? "Datos de demostración: preparación simulada, sin envío de postulación. Requisitos y enlace de ejemplo, no oficiales." : "Confirma nacionalidad, residencia, admisión y demás restricciones en la fuente oficial; el puntaje no confirma elegibilidad.",
        }))
    : [];
  return {
    demo,
    profile,
    opportunities,
    notice: !validGpa
      ? "Falta un promedio y una escala válidos para calcular la compatibilidad."
      : demo
        ? opportunities.length ? "Plan de demostración · Datos de demostración. Compatibilidad calculada; no representa una postulación real." : "No hay una beca de demostración habilitada, vigente y compatible con estos datos. Revisa el perfil y la beca elegida."
      : !real.length
        ? "Actualmente no hay becas reales con datos verificados disponibles. El catálogo contiene ejemplos ficticios; no se recomiendan como convocatorias reales."
        : !opportunities.length
          ? "No se encontraron becas verificadas con compatibilidad suficiente y fecha futura para estos datos."
          : "Compatibilidad calculada con las reglas de BecaMatch; la elegibilidad final debe confirmarse en la convocatoria.",
    steps: demo ? ["Revisa tu perfil de prueba y la compatibilidad calculada.", "Prepara los documentos ilustrativos indicados en esta beca.", "Revisa los pasos del intercambio como simulación; no se envía ninguna postulación."] : [
      "Completa o revisa tu perfil en BecaMatch.",
      "Consulta los requisitos y las fechas en cada fuente oficial.",
      "Prepara únicamente documentos confirmados y postula fuera de BecaMatch.",
    ],
  };
}
export type AgentPlan = ReturnType<typeof makeAgentPlan> & {
  planNumber?: string | undefined;
  shareId?: string | undefined;
  shareUrl?: string | undefined;
  createdAt?: string | undefined;
};
export const AGENT_STORAGE_KEY = "becamatch:postulation-agent:v1";
