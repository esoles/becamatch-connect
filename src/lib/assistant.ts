// Deterministic assistant: answers ONLY from stored scholarship fields. No AI, no invention.
type S = {
  name: string; entity: string; country: string; deadline: string; area: string | null;
  study_level: string | null; coverage: string | null; requirements: string | null;
  documents: string | null; official_url: string | null; min_gpa: number | null;
  language_code: string | null; language_level: string | null;
};

const FIELDS: { label: string; keys: string[]; get: (s: S) => string | null }[] = [
  { label: "Fecha límite", keys: ["deadline", "fecha", "limite", "cierre", "plazo", "vence", "cuando"], get: (s) => s.deadline },
  { label: "País", keys: ["pais", "donde", "lugar"], get: (s) => s.country },
  { label: "Entidad", keys: ["entidad", "organiza", "otorga", "institucion"], get: (s) => s.entity },
  { label: "Nivel de estudio", keys: ["nivel", "pregrado", "maestria", "doctorado", "posgrado"], get: (s) => s.study_level },
  { label: "Área", keys: ["area", "carrera", "campo", "disciplina"], get: (s) => s.area },
  { label: "Cobertura", keys: ["cobertura", "cubre", "incluye", "beneficio", "monto", "dinero", "pago"], get: (s) => s.coverage },
  { label: "Requisitos", keys: ["requisito", "requiere", "necesito", "condicion"], get: (s) => s.requirements },
  { label: "Documentos requeridos", keys: ["documento", "papeles", "adjuntar"], get: (s) => s.documents },
  { label: "Enlace oficial", keys: ["enlace", "link", "url", "web", "postular", "pagina"], get: (s) => s.official_url },
  { label: "Promedio mínimo", keys: ["promedio", "nota", "gpa", "calificacion"], get: (s) => (s.min_gpa == null ? null : `${s.min_gpa} / 20`) },
  { label: "Idioma requerido", keys: ["idioma", "ingles", "lengua", "cefr"], get: (s) => (s.language_code ? `${s.language_code}${s.language_level ? " " + s.language_level : ""}` : null) },
];

export const QUICK_QUESTIONS = ["¿Cuál es la fecha límite?", "¿Qué cubre?", "¿Qué documentos piden?", "¿Cuál es el promedio mínimo?", "¿Tiene edad máxima?"];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function answer(s: S, question: string): { known: boolean; text: string } {
  const q = norm(question);
  const f = FIELDS.find((x) => x.keys.some((k) => q.includes(k)));
  if (!f) return { known: false, text: "Ese dato no está registrado para esta beca. Consulta el enlace oficial." };
  const v = f.get(s);
  if (!v || !v.trim()) return { known: false, text: `${f.label}: no está registrado / no disponible para esta beca.` };
  return { known: true, text: `${f.label}: ${v}` };
}
