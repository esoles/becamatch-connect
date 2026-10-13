import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { daysLeft, fmtDate, scholarshipsQuery } from "@/lib/profile";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Becas — Panel BecaMatch" },
      { name: "description", content: "Gestión de becas de demostración." },
      { property: "og:title", content: "Becas — Panel BecaMatch" },
      { property: "og:description", content: "Gestión de becas de demostración." },
    ],
  }),
  component: AdminBecas,
});

function AdminBecas() {
  const s = useQuery(scholarshipsQuery);
  return (
    <section className="mt-6">
      <p className="text-sm text-muted-foreground">Vista de solo lectura.</p>
      {s.isError && <p className="mt-4 text-destructive">No se pudieron cargar las becas.</p>}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-3">Nombre</th><th className="p-3">País</th><th className="p-3">Fecha límite</th><th className="p-3">Estado</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {(s.data ?? []).map((x) => (
              <tr key={x.id} className="border-t border-border">
                <td className="p-3 font-medium">{x.name}</td>
                <td className="p-3">{x.country}</td>
                <td className="p-3">{fmtDate(x.deadline)}</td>
                <td className="p-3">{x.archived ? "Archivada" : daysLeft(x.deadline) < 0 ? "Expirada" : "Activa"}</td>
                <td className="p-3">{x.es_demo && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">Demo</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
