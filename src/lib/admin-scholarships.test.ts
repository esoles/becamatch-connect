import { describe, expect, it } from "vitest";
import {
  canVerifyScholarship,
  verificationLabel,
  expiryLabel,
  summaryMetrics,
  verificationUpdate,
  type AdminScholarship,
} from "./admin-scholarships";
const row: AdminScholarship = {
  id: "test",
  name: "Beca",
  entity: "Entidad",
  country: "Perú",
  study_level: null,
  area: null,
  deadline: "2026-11-01",
  archived: false,
  es_demo: false,
  verified: true,
  estado_datos: "verificada",
  official_url: "https://example.org",
  created_at: "2026-10-18",
  coverage: null,
  requirements: null,
  documents: null,
  language_code: null,
  language_level: null,
  min_gpa: null,
  aviso_datos: null,
  fuente_requisitos: null,
  ultima_verificacion: null,
  requisitos_detallados: [],
  documentos_requeridos: [],
  proceso_postulacion: [],
  restricciones: [],
  preguntas_frecuentes: [],
};
describe("administrative scholarship provenance", () => {
  it("manually verifies after source confirmation and records the date", () => {
    expect(verificationUpdate(row, true, "https://example.org", true, "2026-10-18")).toEqual({ verified: true, estado_datos: "verificada", fuente_requisitos: "https://example.org", ultima_verificacion: "2026-10-18" });
    expect(() => verificationUpdate(row, true, "https://example.org", false, "2026-10-18")).toThrow();
  });
  it("turns verification off without inventing a verification date", () => {
    expect(verificationUpdate(row, false, undefined, undefined, "2026-10-18")).toEqual({ verified: false, estado_datos: "pendiente_verificacion", ultima_verificacion: null });
  });
  it("enables demo verification for testing without changing provenance or inventing a source check", () => {
    expect(verificationUpdate({ ...row, es_demo: true }, true, undefined, undefined, "2026-10-18")).toEqual({ verified: true });
  });
  it("disables demo verification for testing without changing original facts", () => {
    expect(verificationUpdate({ ...row, es_demo: true }, false, undefined, undefined, "2026-10-18")).toEqual({ verified: false });
  });
  it("keeps test-enabled demos out of real verification totals", () => {
    expect(summaryMetrics([{ ...row, es_demo: true, verified: true }], "2026-10-18").verified).toBe(0);
  });
  it("does not count demonstration records as real verified opportunities", () => {
    expect(summaryMetrics([{ ...row, es_demo: true }, row], "2026-10-18")).toEqual({
      total: 1,
      demo: 1,
      verified: 1,
      pending: 0,
      expiring: 1,
    });
  });
  it("never allows fictional examples to be verified", () => {
    expect(canVerifyScholarship({ ...row, estado_datos: "propuesta_ficticia_no_verificada" })).toBe(
      false,
    );
  });
  it("requires an official source for verification", () => {
    expect(canVerifyScholarship({ ...row, official_url: null })).toBe(false);
  });
  it("requires both factual verification status and the verified flag", () => {
    expect(verificationLabel({ ...row, estado_datos: "pendiente_verificacion" })).toBe(
      "Pendiente de verificación",
    );
  });
  it("defines expiring as a future deadline within 30 days", () => {
    expect(expiryLabel("2026-11-17", "2026-10-18")).toBe("Próxima a vencer");
    expect(expiryLabel("2026-11-18", "2026-10-18")).toBe("Vigente");
    expect(expiryLabel("2026-10-18", "2026-10-18")).toBe("Vencida");
  });
});
