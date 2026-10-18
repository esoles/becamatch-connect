import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/profile";

const solicitudesQuery = queryOptions({
  queryKey: ["admin", "postulation-requests"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("postulation_requests")
      .select("id, full_name, email, request_text, status, recommended_scholarship_ids, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

const STATUS_LABEL: Record<string, string> = {
  recibida: "Recibida",
  analizada: "Analizada",
  correo_enviado: "Correo enviado",
  error: "Error",
};

export const Route = createFileRoute("/admin/solicitudes")({
  validateSearch: (s: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof s["id"] === "string" ? s["id"] : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(solicitudesQuery),
  head: () => ({
    meta: [
      { title: "Solicitudes de postulación — BecaMatch" },
      {
        name: "description",
        content: "Solicitudes recibidas desde el formulario público de postulación.",
      },
      { property: "og:title", content: "Solicitudes de postulación — BecaMatch" },
      {
        property: "og:description",
        content: "Solicitudes recibidas desde el formulario público de postulación.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SolicitudesPage,
});

function SolicitudesPage() {
  const { data: rows } = useSuspenseQuery(solicitudesQuery);
  const { id } = Route.useSearch();
  const visibleRows = id ? rows.filter((r) => r.id === id) : rows;
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-semibold">Solicitudes de postulación</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Visitantes que pidieron un plan de postulación desde el formulario público.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Aún no hay solicitudes.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Correo</th>
                <th className="px-4 py-2 font-medium">Solicitud</th>
                <th className="px-4 py-2 font-medium">Becas rec.</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">
                    <Link
                      to="/admin/whatsapp"
                      search={{ interaction: `form:${r.id}` }}
                      className="text-primary underline"
                    >
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{r.email}</td>
                  <td className="max-w-xs px-4 py-2">
                    <span className="line-clamp-2">{r.request_text}</span>
                  </td>
                  <td className="px-4 py-2">{r.recommended_scholarship_ids.length}</td>
                  <td className="px-4 py-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {fmtDate(r.created_at.slice(0, 10))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
