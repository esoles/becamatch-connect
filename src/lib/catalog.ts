export const STUDY_LEVELS = ["Pregrado", "Maestría", "Doctorado"];
export const AREAS = ["Ingeniería", "Ciencias", "Salud", "Ciencias Sociales", "Humanidades", "Negocios", "Artes"];
export const COUNTRIES = ["Alemania", "Canadá", "Chile", "España", "Estados Unidos", "Francia", "México", "Perú", "Reino Unido"];
export const LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "Inglés" },
  { code: "de", name: "Alemán" },
  { code: "fr", name: "Francés" },
  { code: "pt", name: "Portugués" },
];
export const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
