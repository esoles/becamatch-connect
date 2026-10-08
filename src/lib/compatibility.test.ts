import { describe, expect, it } from "vitest";
import { buildDeck, evaluate, languageScore, isMinor, type CompatScholarship } from "./compatibility";

const profile = {
  study_level: "Maestría",
  area: "Ingeniería",
  countries: ["Chile"],
  languages: [{ code: "en", level: "B1" as const }],
  gpa: 15,
};
const base: CompatScholarship = {
  id: "1", name: "A", country: "Chile", study_level: "Maestría", area: "Ingeniería",
  language_code: "en", language_level: "B2", min_gpa: 14, deadline: "2099-01-01",
  verified: true, archived: false,
};

describe("compatibility", () => {
  it("language steps", () => {
    expect(languageScore("B2", "B2")).toBe(100);
    expect(languageScore("B2", "B1")).toBe(70);
    expect(languageScore("B2", "A2")).toBe(40);
    expect(languageScore("B2", "A1")).toBe(0);
  });
  it("weighted & reproducible", () => {
    const r = evaluate(profile, base);
    // (30+25+0.7*15+20+10)/100 = 95.5 -> 96
    expect(r.compatibility_score).toBe(96);
    expect(evaluate(profile, base)).toEqual(r);
  });
  it("renormalizes non-evaluable", () => {
    const r = evaluate(profile, { ...base, area: null, language_code: null, min_gpa: null });
    expect(r.compatibility_score).toBe(100);
  });
  it("gpa below min is ineligible", () => {
    const r = evaluate(profile, { ...base, min_gpa: 17 });
    expect(r.eligible).toBe(false);
  });
  it("filters and sorts", () => {
    const d = buildDeck(profile, [
      { ...base, id: "2", name: "B", deadline: "2098-01-01" },
      base,
      { ...base, id: "3", archived: true },
      { ...base, id: "4", deadline: "2000-01-01" },
    ], "2026-10-08");
    expect(d.eligible.map((r) => r.scholarship.id)).toEqual(["2", "1"]);
  });
  it("minor", () => {
    expect(isMinor("2010-01-01", new Date("2026-10-08"))).toBe(true);
    expect(isMinor("2000-01-01", new Date("2026-10-08"))).toBe(false);
  });
});
