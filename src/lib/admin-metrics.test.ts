import { describe, it, expect } from "vitest";
import {
  aggregateMetrics,
  limaDay,
  quickRange,
  isFictionalMetricRecord,
  type MetricPerson,
} from "./admin-metrics";
const range = { from: "2026-10-01", to: "2026-10-24" };
const person: MetricPerson = {
  key: "user:a",
  createdAt: "2026-10-24T05:00:00Z",
  channel: "Formulario",
  stage: "postulado",
  priority: 60,
};
describe("real administrative metrics", () => {
  it("uses Lima midnight not UTC midnight", () => {
    expect(limaDay("2026-10-24T04:59:59Z")).toBe("2026-10-23");
    expect(limaDay("2026-10-24T05:00:00Z")).toBe("2026-10-24");
  });
  it("deduplicates identities and repeated submission transitions", () => {
    const m = aggregateMetrics(
      [person, person],
      [
        { key: person.key, date: person.createdAt },
        { key: person.key, date: "2026-10-24T06:00:00Z" },
      ],
      range,
    );
    expect(m.leads).toBe(1);
    expect(m.submissions).toBe(1);
    expect(m.days.at(-1)?.["Formulario"]).toBe(1);
  });
  it("priority is followup score at least 60 and excludes unevaluated", () => {
    expect(
      aggregateMetrics(
        [person, { ...person, key: "b", priority: 59 }, { ...person, key: "c", priority: null }],
        [],
        range,
      ).priority,
    ).toBe(1);
  });
  it("conversion uses advanced stages and never counts preparing as submitted", () => {
    const m = aggregateMetrics([person, { ...person, key: "b", stage: "preparando" }], [], range);
    expect(m.converted).toBe(1);
    expect(m.conversion).toBe(50);
    expect(m.submissions).toBe(0);
  });
  it("handles empty denominators", () => {
    const m = aggregateMetrics([], [], range);
    expect(m.conversion).toBe(0);
    expect(m.average).toBe(0);
  });
  it("all indicators respond to dates", () => {
    const m = aggregateMetrics([person], [{ key: person.key, date: person.createdAt }], {
      from: "2026-10-01",
      to: "2026-10-23",
    });
    expect(m.leads).toBe(0);
    expect(m.priority).toBe(0);
    expect(m.submissions).toBe(0);
    expect(m.funnel.every((s) => s.count === 0)).toBe(true);
  });
  it("excludes explicitly fictional labels without mistaking references to missing fiction as fake", () => {
    expect(isFictionalMetricRecord("Ana · CASO DE PRUEBA")).toBe(true);
    expect(isFictionalMetricRecord("Ejemplo ficticio de solicitud")).toBe(true);
    expect(isFictionalMetricRecord("Prueba Flujo")).toBe(true);
    expect(isFictionalMetricRecord("Quiero becas reales, no ficticias")).toBe(false);
  });
  it("quick ranges include today and exact 7 or 30 days", () => {
    const now = Date.parse("2026-10-24T06:00:00Z");
    expect(quickRange("week", now)).toEqual({ from: "2026-10-18", to: "2026-10-24" });
    expect(quickRange("month", now)).toEqual({ from: "2026-09-25", to: "2026-10-24" });
    expect(quickRange("current", now)).toEqual(range);
  });
});
