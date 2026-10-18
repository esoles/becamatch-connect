import { describe, expect, it } from "vitest";
import { makeAgentPlan, type AgentProfile, type PlanScholarship } from "./postulation-agent";
import { shareablePlan, remainingDays, selectedOpportunity, sharedPlanSchema } from "./shared-plan";
import { planForSelection } from "./shared-plan.server";

const profile: AgentProfile = { name: "Private name", residence: "Private residence", nationality: "Private nationality", currentLevel: "Pregrado", desiredLevel: "Maestría", area: "Ingeniería", gpa: 16, gpaScale: 20, languages: [], countries: ["Canadá"], startYear: null, funding: "Private funding" };
const scholarship: PlanScholarship = { id: "existing-scholarship", name: "Verified opportunity", entity: "University", country: "Canadá", study_level: "Maestría", area: "Ingeniería", min_gpa: 15, language_code: null, language_level: null, deadline: "2026-10-21", verified: true, archived: false, es_demo: false, estado_datos: "verificada", requirements: "Existing eligibility", coverage: null, documents: null, official_url: "https://example.org/call", documentos_requeridos: [{ nombre: "Official transcript", obligatorio: true }, { nombre: "Portfolio", obligatorio: false }], proceso_postulacion: ["Official step"] };
describe("secure application plan", () => {
  it("shares scholarship facts without private profile fields", () => {
    const output = shareablePlan(makeAgentPlan(profile, [scholarship], "2026-10-18"));
    expect(JSON.stringify(output)).not.toContain("Private");
    expect(output).not.toHaveProperty("profile");
    expect(output.opportunities[0]?.id).toBe("existing-scholarship");
  });
  it("retains exact source documents and mandatory flags", () => {
    expect(shareablePlan(makeAgentPlan(profile, [scholarship], "2026-10-18")).opportunities[0]?.orientation.documents).toEqual([{ nombre: "Official transcript", obligatorio: true }, { nombre: "Portfolio", obligatorio: false }]);
  });
  it("retains exact source steps", () => {
    expect(shareablePlan(makeAgentPlan(profile, [scholarship], "2026-10-18")).opportunities[0]?.orientation.steps).toEqual(["Official step"]);
  });
  it("does not invent compatibility without a profile", () => { expect(selectedOpportunity(scholarship, null).score).toBeNull(); });
  it("reports exactly three days remaining", () => { expect(remainingDays("2026-10-21", "2026-10-18")).toBe(3); });
  it("does not fabricate documents when missing", () => { expect(selectedOpportunity({ ...scholarship, documentos_requeridos: [] }, null).orientation.documents).toEqual([]); });
  it("never stores demo scholarships in selection plans", () => { expect(planForSelection([{ ...scholarship, es_demo: true }], null).opportunities).toEqual([]); });
  it("never stores unverified scholarships in selection plans", () => { expect(planForSelection([{ ...scholarship, verified: false }], null).opportunities).toEqual([]); });
  it("removes injected private fields when parsing shared content", () => { const safe = shareablePlan(makeAgentPlan(profile, [scholarship], "2026-10-18")); expect(sharedPlanSchema.parse({ ...safe, email: "private@example.org", conversation: "secret" })).toEqual(safe); });
  it("rejects unsafe source URLs", () => { const safe = shareablePlan(makeAgentPlan(profile, [scholarship], "2026-10-18")); const opportunity = safe.opportunities[0]; if (!opportunity) throw new Error("Missing test opportunity"); opportunity.url = "javascript:alert(1)"; expect(sharedPlanSchema.safeParse(safe).success).toBe(false); });
});