/** Deterministic catalog matching; ambiguous names never silently select a scholarship. */
export function normalizeScholarshipName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchScholarshipNames<T extends { id: string; name: string }>(
  rows: T[], name: string,
) {
  const query = normalizeScholarshipName(name);
  if (!query) return [];
  const exact = rows.filter((row) => normalizeScholarshipName(row.name) === query);
  if (exact.length) return exact;
  const terms = query.split(" ");
  return rows.filter((row) => {
    const words = normalizeScholarshipName(row.name).split(" ");
    return terms.every((term) => words.includes(term));
  }).sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));
}