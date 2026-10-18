import { z } from "zod";
import { evaluate, explain, type CompatProfile } from "./compatibility";
import { orientationData } from "./scholarship-orientation";
import type { AgentPlan, PlanScholarship } from "./postulation-agent";

const nullableText = z.string().nullable();
const safeUrl = z.string().url().refine((s) => /^https?:\/\//.test(s)).nullable();
export const sharedPlanSchema = z.object({
  notice: z.string(),
  steps: z.array(z.string()),
  opportunities: z.array(z.object({
    id: z.string(), name: z.string(), entity: z.string(), country: z.string(),
    studyLevel: nullableText, area: nullableText, deadline: z.string(), url: safeUrl,
    coverage: nullableText, score: z.number().min(0).max(100).nullable(), reasons: z.string(),
    requirements: nullableText, legacyDocuments: nullableText, pending: z.string(),
    language: nullableText,
    orientation: z.object({
      requirements: z.array(z.string()),
      documents: z.array(z.object({ nombre: z.string(), obligatorio: z.boolean() })),
      steps: z.array(z.string()), restrictions: z.array(z.string()), source: safeUrl,
      checkedAt: nullableText,
    }),
  })),
});
export type SharedPlan = z.infer<typeof sharedPlanSchema>;
const url = (value: string | null | undefined) => value && /^https?:\/\//.test(value) ? value : null;

// Explicit projection: never spread applicant profiles, conversation text or contact fields.
export function shareablePlan(plan: AgentPlan): SharedPlan {
  return sharedPlanSchema.parse({
    notice: plan.notice, steps: plan.steps,
    opportunities: plan.opportunities.map((s) => ({
      id: s.id, name: s.name, entity: s.entity, country: s.country,
      studyLevel: s.studyLevel ?? null, area: s.area ?? null, deadline: s.deadline,
      url: url(s.url), coverage: s.coverage, score: s.score, reasons: s.reasons,
      requirements: s.requirements, legacyDocuments: s.legacyDocuments, pending: s.pending,
      language: s.language ?? null,
      orientation: {
        requirements: s.orientation.requirements, documents: s.orientation.documents,
        steps: s.orientation.steps, restrictions: s.orientation.restrictions,
        source: url(s.orientation.source), checkedAt: s.orientation.checkedAt,
      },
    })),
  });
}
export function selectedOpportunity(s: PlanScholarship, profile: CompatProfile | null) {
  const compatibility = profile ? evaluate(profile, s) : null;
  return {
    id: s.id, name: s.name, entity: s.entity, country: s.country,
    studyLevel: s.study_level, area: s.area,
    language: s.language_code ? `${s.language_code} ${s.language_level ?? ""}`.trim() : null,
    deadline: s.deadline, url: s.official_url, coverage: s.coverage,
    score: compatibility?.compatibility_score ?? null,
    reasons: compatibility ? explain(compatibility.components) : "Compatibilidad sin calcular: completa o confirma tu perfil.",
    requirements: s.requirements, legacyDocuments: s.documents,
    orientation: orientationData(s),
    pending: "Confirma elegibilidad y datos faltantes en la fuente oficial. BecaMatch no envía postulaciones ni garantiza selección.",
  };
}
export function remainingDays(deadline: string, today: string) {
  return Math.ceil((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
export const PLAN_STEPS = [
  "Revisa y completa la información que falta en tu perfil.",
  "Confirma requisitos, documentos y fecha límite en la convocatoria oficial.",
  "Prepara los documentos confirmados y realiza la postulación fuera de BecaMatch.",
];