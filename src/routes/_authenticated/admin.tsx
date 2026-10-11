import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
      <WhatsappHistory />
    </main>
  );
}

function WhatsappHistory() {
  const [phone, setPhone] = useState("");
  const msgs = useQuery({
    queryKey: ["wa-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, phone, direction, body, action, result, created_at, user_id, scholarships(name)")
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
  const all = msgs.data ?? [];
  const phones = [...new Set(all.map((m) => m.phone))];
  const shown = phone ? all.filter((m) => m.phone.includes(phone.trim())) : [];
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold">Historial de WhatsApp</h2>
      <p className="mt-1 text-sm text-muted-foreground">Busca por número para ver mensajes, becas consultadas, acciones y resultados.</p>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51…" className="mt-4 w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2" />
      <div className="mt-3 flex flex-wrap gap-2">
        {phones.map((p) => (
          <button key={p} onClick={() => setPhone(p)} className="rounded-full bg-secondary px-3 py-1 text-xs">{p}</button>
        ))}
        {!msgs.isLoading && phones.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay conversaciones.</p>}
      </div>
      {msgs.isError && <p className="mt-3 text-destructive">No se pudo cargar el historial.</p>}
      {shown.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="p-3">Fecha</th><th className="p-3">Número</th><th className="p-3">Tipo</th><th className="p-3">Mensaje</th><th className="p-3">Beca</th><th className="p-3">Acción</th><th className="p-3">Resultado</th><th className="p-3">Cuenta</th></tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.id} className="border-t border-border align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(m.created_at).toLocaleString("es-PE")}</td>
                  <td className="p-3">{m.phone}</td>
                  <td className="p-3">{m.direction}</td>
                  <td className="p-3 whitespace-pre-wrap">{m.body}</td>
                  <td className="p-3">{m.scholarships?.name ?? "—"}</td>
                  <td className="p-3">{m.action ?? "—"}</td>
                  <td className="p-3">{m.result ?? "—"}</td>
                  <td className="p-3">{m.user_id ? "Vinculada" : "Anónimo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
