import { createFileRoute } from "@tanstack/react-router";
import { AdminScholarships } from "@/components/admin-scholarships";
export const Route = createFileRoute("/admin/verificacion")({
  validateSearch: (s: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof s["id"] === "string" ? s["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verificación de becas — BecaMatch" },
      {
        name: "description",
        content: "Revisión explícita de datos de becas y sus fuentes oficiales.",
      },
      { property: "og:title", content: "Verificación de becas — BecaMatch" },
      { property: "og:description", content: "Revisión de fuentes oficiales de convocatorias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VerificacionPage,
});
function VerificacionPage() {
  const { id } = Route.useSearch();
  return <AdminScholarships verificationOnly selectedId={id} />;
}
