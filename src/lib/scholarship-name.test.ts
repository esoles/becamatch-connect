import { describe, expect, it } from "vitest";
import { matchScholarshipNames } from "./scholarship-name";

const catalog = [
  { id: "1", name: "Programa Líderes Digitales" },
  { id: "2", name: "Programa Líderes Globales" },
];
describe("scholarship lookup by name", () => {
  it("finds the exact name without depending on accents or casing", () => {
    expect(matchScholarshipNames(catalog, " PROGRAMA lideres DIGITALES ")).toEqual([catalog[0]]);
  });
  it("finds a unique partial name", () => {
    expect(matchScholarshipNames(catalog, "Líderes Digitales")).toEqual([catalog[0]]);
  });
  it("returns all ambiguous matches instead of choosing one", () => {
    expect(matchScholarshipNames(catalog, "Líderes").map((row) => row.id)).toEqual(["1", "2"]);
  });
  it("never invents a missing scholarship or matches an empty name", () => {
    expect(matchScholarshipNames(catalog, "Beca inexistente")).toEqual([]);
    expect(matchScholarshipNames(catalog, " ")).toEqual([]);
  });
  it("prefers an exact name over longer partial matches", () => {
    expect(matchScholarshipNames([...catalog, { id: "3", name: "Programa Líderes Digitales Europa" }], catalog[0].name)).toEqual([catalog[0]]);
  });
});