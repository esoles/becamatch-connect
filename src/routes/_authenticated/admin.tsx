import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { daysLeft, fmtDate, scholarshipsQuery } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración — BecaMatch" },
      { name: "description", content: "Vista mínima de administración de becas demo." },
      { property: "og:title", content: "Administración — BecaMatch" },
      { property: "og:description", content: "Vista mínima de administración." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const role = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return !!data;
    },
  });
  const s = useQuery(scholarshipsQuery);
  if (role.isLoading) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  if (!role.data)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Esta vista es solo para administradores.</p>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold">Administración</h1>
        <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">Datos de demostración</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Vista de solo lectura.</p>
      {s.isError && <p className="mt-4 text-destructive">No se pudieron cargar las becas.</p>}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card">
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
    </main>
  );
}
