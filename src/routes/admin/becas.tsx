import { createFileRoute } from "@tanstack/react-router";
import { AdminScholarships } from "@/components/admin-scholarships";
export const Route = createFileRoute("/admin/becas")({
  validateSearch: (s: Record<string, unknown>) => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Gestión de becas — BecaMatch" },
      {
        name: "description",
        content: "Consulta, edición y gestión de convocatorias de BecaMatch.",
      },
      { property: "og:title", content: "Gestión de becas — BecaMatch" },
      { property: "og:description", content: "Gestión administrativa de convocatorias y fuentes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => {
    const { id } = Route.useSearch();
    return <AdminScholarships selectedId={id} />;
  },
});
