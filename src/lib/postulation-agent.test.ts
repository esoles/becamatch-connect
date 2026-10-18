import { describe, it, expect } from "vitest";
import { makeAgentPlan, type AgentProfile, type PlanScholarship } from "./postulation-agent";

const profile: AgentProfile = { name: "", residence: "Perú", nationality: "Perú", currentLevel: "pregrado", desiredLevel: "maestría", area: "Ingeniería", gpa: 16, gpaScale: 20, languages: [{ code: "en", level: "B2" }], countries: ["Canadá"], startYear: 2027, funding: "Completo" };
const scholarship: PlanScholarship = { id: "test", name: "Test opportunity", entity: "Test", country: "Canadá", study_level: "maestría", area: "Ingeniería", language_code: "en", language_level: "B2", min_gpa: 15, deadline: "2027-02-15", verified: true, archived: false, es_demo: false, estado_datos: "verificada", coverage: null, requirements: null, documents: null, official_url: null };
describe("conversational postulation plan", () => {
  it("uses the existing 0–100 compatibility rules", () => { expect(makeAgentPlan(profile, [scholarship], "2026-10-18").opportunities[0]?.score).toBe(100); });
  it("never recommends fictional or pending data as official opportunities", () => { expect(makeAgentPlan(profile, [{ ...scholarship, es_demo: true }, { ...scholarship, estado_datos: "pendiente_verificacion" }], "2026-10-18").opportunities).toEqual([]); });
  it("only recommends verified scholarships with a future deadline", () => { expect(makeAgentPlan(profile, [{ ...scholarship, verified: false }, { ...scholarship, deadline: "2026-10-18" }], "2026-10-18").opportunities).toEqual([]); });
  it("does not infer a GPA when the scale is missing", () => { expect(makeAgentPlan({ ...profile, gpaScale: null }, [scholarship], "2026-10-18").opportunities).toEqual([]); });
  it("does not invent documents absent from the catalog", () => { expect(makeAgentPlan(profile, [scholarship], "2026-10-18").opportunities[0]?.orientation.documents).toEqual([]); });
});