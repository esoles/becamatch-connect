// Pure, deterministic compatibility calculation (SPEC §7). No AI, no randomness.

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof CEFR)[number];

export const WEIGHTS = { level: 30, area: 25, language: 15, gpa: 20, country: 10 } as const;
export type Criterion = keyof typeof WEIGHTS;

export interface UserLanguage {
  code: string;
  level: Cefr;
}

export interface CompatProfile {
  study_level: string;
  area: string;
  countries: string[];
  languages: UserLanguage[];
  gpa: number;
}

export interface CompatScholarship {
  id: string;
  name: string;
  country: string;
  study_level: string | null;
  area: string | null;
  language_code: string | null;
  language_level: string | null;
  min_gpa: number | null;
  deadline: string; // YYYY-MM-DD
  verified: boolean;
  archived: boolean;
}

export interface CompatResult<S extends CompatScholarship = CompatScholarship> {
  scholarship: S;
  eligible: boolean;
  ineligibleReason: string | null;
  compatibility_score: number;
  components: Partial<Record<Criterion, number>>;
}

const norm = (s: string) => s.trim().toLowerCase();

export function isAvailable(s: CompatScholarship, today: string): boolean {
  return s.verified && !s.archived && s.deadline > today;
}

export function languageScore(required: string | null, user: Cefr | undefined): number {
  const reqIdx = CEFR.indexOf(required as Cefr);
  if (reqIdx < 0) return 0;
  const userIdx = user ? CEFR.indexOf(user) : -1;
  if (userIdx < 0) return 0;
  const gap = reqIdx - userIdx;
  if (gap <= 0) return 100;
  if (gap === 1) return 70;
  if (gap === 2) return 40;
  return 0;
}

export function scoreComponents(p: CompatProfile, s: CompatScholarship) {
  const c: Partial<Record<Criterion, number>> = {};
  if (s.study_level) c.level = norm(s.study_level) === norm(p.study_level) ? 100 : 0;
  if (s.area) {
    const areas = s.area.split(",").map(norm);
    c.area = areas.includes("todas") || areas.includes(norm(p.area)) ? 100 : 0;
  }
  if (s.language_code && s.language_level) {
    const ul = p.languages.find((l) => norm(l.code) === norm(s.language_code!));
    c.language = languageScore(s.language_level, ul?.level);
  }
  if (s.min_gpa !== null && s.min_gpa !== undefined) c.gpa = p.gpa >= Number(s.min_gpa) ? 100 : 0;
  if (p.countries.length > 0) c.country = p.countries.map(norm).includes(norm(s.country)) ? 100 : 0;
  return c;
}

export function weightedScore(c: Partial<Record<Criterion, number>>): number {
  let total = 0;
  let weight = 0;
  for (const k of Object.keys(c) as Criterion[]) {
    total += c[k]! * WEIGHTS[k];
    weight += WEIGHTS[k];
  }
  if (weight === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(total / weight)));
}

export function evaluate<S extends CompatScholarship>(p: CompatProfile, s: S): CompatResult<S> {
  const components = scoreComponents(p, s);
  const failsGpa = s.min_gpa !== null && s.min_gpa !== undefined && p.gpa < Number(s.min_gpa);
  return {
    scholarship: s,
    eligible: !failsGpa,
    ineligibleReason: failsGpa ? `Requiere promedio mínimo ${Number(s.min_gpa)}/20` : null,
    compatibility_score: weightedScore(components),
    components,
  };
}

export function compareResults(a: CompatResult, b: CompatResult): number {
  if (b.compatibility_score !== a.compatibility_score)
    return b.compatibility_score - a.compatibility_score;
  if (a.scholarship.deadline !== b.scholarship.deadline)
    return a.scholarship.deadline < b.scholarship.deadline ? -1 : 1;
  return a.scholarship.name.localeCompare(b.scholarship.name, "es");
}

export function buildDeck<S extends CompatScholarship>(p: CompatProfile, list: S[], today: string) {
  const evaluated = list.filter((s) => isAvailable(s, today)).map((s) => evaluate(p, s));
  const eligible = evaluated.filter((r) => r.eligible).sort(compareResults);
  const ineligible = evaluated.filter((r) => !r.eligible).sort(compareResults);
  return { eligible, ineligible };
}

const LABELS: Record<Criterion, string> = {
  level: "Nivel",
  area: "Área",
  language: "Idioma",
  gpa: "Promedio",
  country: "País",
};

export function explain(c: Partial<Record<Criterion, number>>): string {
  const ok = (Object.keys(c) as Criterion[]).filter((k) => c[k] === 100).map((k) => LABELS[k]);
  const partial = (Object.keys(c) as Criterion[])
    .filter((k) => c[k]! > 0 && c[k]! < 100)
    .map((k) => LABELS[k]);
  const no = (Object.keys(c) as Criterion[]).filter((k) => c[k] === 0).map((k) => LABELS[k]);
  const parts: string[] = [];
  if (ok.length) parts.push(`Coincide: ${ok.join(", ")}`);
  if (partial.length) parts.push(`Parcial: ${partial.join(", ")}`);
  if (no.length) parts.push(`No coincide: ${no.join(", ")}`);
  return parts.join(" · ") || "Sin criterios evaluables";
}

export function isMinor(birthDate: string, today = new Date()): boolean {
  const b = new Date(birthDate + "T00:00:00");
  const limit = new Date(today);
  limit.setFullYear(limit.getFullYear() - 18);
  return b > limit;
}

export const PRIORITY_SCORE = 50;
export const MIN_DECK = 5;

/** Splits eligible results into priority (score >= 50) and the rest; order is preserved. */
export function splitPriority<R extends CompatResult>(eligible: R[]) {
  return {
    priority: eligible.filter((r) => r.compatibility_score >= PRIORITY_SCORE),
    others: eligible.filter((r) => r.compatibility_score < PRIORITY_SCORE),
  };
}
