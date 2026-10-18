import { describe, expect, it } from "vitest";
import { orientationData } from "./scholarship-orientation";

describe("orientation provenance", () => {
  it("never treats fictional proposals as verified", () => {
    const result = orientationData({ estado_datos: "propuesta_ficticia_no_verificada" });
    expect(result.illustrative).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.checkedAt).toBeNull();
  });
  it("does not upgrade a demo record to official facts", () => {
    expect(orientationData({ es_demo: true, estado_datos: "verificada" }).verified).toBe(false);
  });
  it("preserves required versus optional document flags without adding documents", () => {
    const docs = [{ nombre: "Documento de identidad", obligatorio: true }, { nombre: "Constancia de idioma español", obligatorio: false }];
    expect(orientationData({ documentos_requeridos: docs }).documents).toEqual(docs);
    expect(orientationData({}).documents).toEqual([]);
  });
  it("does not invent missing requirements, steps or FAQ answers", () => {
    const result = orientationData({ estado_datos: "pendiente_verificacion" });
    expect(result.verified).toBe(false);
    expect(result.requirements).toEqual([]);
    expect(result.steps).toEqual([]);
    expect(result.faqs).toEqual([]);
  });
});