import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listPostulantes, type PostulanteEstado } from "@/lib/postulantes.functions";
import { fmtDate } from "@/lib/profile";

const postulantesQuery = queryOptions({
  queryKey: ["admin", "postulantes"],
  queryFn: async () => {
    const res = await listPostulantes();
    if (!res.ok) throw new Error(res.error);
    return res.rows;
  },
});

const ESTADO_LABEL: Record<PostulanteEstado, string> = {
  nuevo: "Nuevo",
  perfil_completado: "Perfil completado",
  explorando: "Explorando becas",
  preparando_documentos: "Preparando documentos",
  inactivo: "Inactivo",
};

export const Route = createFileRoute("/admin/postulantes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(postulantesQuery),
  head: () => ({
    meta: [
      { title: "Postulantes — BecaMatch" },
      { name: "description", content: "Seguimiento de postulantes registrados en BecaMatch." },
    ],
  }),
  component: PostulantesPage,
});

function PostulantesPage() {
  const { data: rows } = useSuspenseQuery(postulantesQuery);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<string>("todos");
  const [orden, setOrden] = useState<"actividad" | "deadline">("actividad");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter(
      (r) =>
        (estado === "todos" || r.estado === estado) &&
        (!needle || r.nombre.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle)),
    );
    if (orden === "deadline") {
      list = [...list].sort((a, b) => (a.proximaDeadline ?? "9999").localeCompare(b.proximaDeadline ?? "9999"));
    }
    return list;
  }, [rows, q, estado, orden]);

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-semibold">Postulantes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Seguimiento de personas registradas o que solicitaron un plan. Cada fila es una persona única identificada por su correo.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o correo"
          className="w-64 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as "actividad" | "deadline")}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="actividad">Ordenar por última actividad</option>
          <option value="deadline">Ordenar por próxima fecha límite</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No hay postulantes que coincidan con el filtro.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Postulante</th>
                <th className="px-4 py-2 font-medium">Canal</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Guardadas</th>
                <th className="px-4 py-2 font-medium">Última actividad</th>
                <th className="px-4 py-2 font-medium">Próx. fecha límite</th>
                <th className="px-4 py-2 font-medium">Acción sugerida</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.nombre}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-2">{r.canal || "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                      {ESTADO_LABEL[r.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.guardadas}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {r.ultimaActividad ? fmtDate(r.ultimaActividad.slice(0, 10)) : "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {r.proximaDeadline ? fmtDate(r.proximaDeadline) : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{r.accionSugerida}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
