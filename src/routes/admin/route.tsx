import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { LayoutDashboard, UsersRound, Inbox, GraduationCap, ClipboardCheck, Megaphone, MessageCircle, ShieldCheck, Menu, X, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/account-menu";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login", next: "admin" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    return { user: data.user, isAdmin: !!isAdmin };
  },
  head: () => ({
    meta: [
      { title: "Panel administrativo — BecaMatch" },
      { name: "description", content: "Gestión de becas, conversaciones de WhatsApp y administradores." },
      { property: "og:title", content: "Panel administrativo — BecaMatch" },
      { property: "og:description", content: "Panel de administración de BecaMatch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin } = Route.useRouteContext();
  const [open, setOpen] = useState(false);
  const pathname = useLocation({ select: location => location.pathname });
  const groups = [
    { label: "General", links: [{ to: "/admin", label: "Resumen", icon: LayoutDashboard }, { to: "/admin/postulantes", label: "Postulantes", icon: UsersRound }, { to: "/admin/solicitudes", label: "Solicitudes", icon: Inbox }] },
    { label: "Gestión de becas", links: [{ to: "/admin/becas", label: "Becas", icon: GraduationCap }, { to: "/admin/verificacion", label: "Verificación de becas", icon: ClipboardCheck }] },
    { label: "Crecimiento", links: [{ to: "/admin/marketing", label: "Marketing", icon: Megaphone }, { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle }] },
    { label: "Sistema", links: [{ to: "/admin/usuarios", label: "Administradores", icon: ShieldCheck }] },
  ] as const;
  const title = groups.flatMap(g => g.links).find(l => l.to === pathname.replace(/\/$/, ""))?.label ?? "Administración";
  if (!isAdmin)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Esta vista es solo para administradores. Tu cuenta no tiene el rol admin.</p>
      </main>
    );
  return (
    <div className="admin-space min-h-screen bg-background">
      {open && <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform motion-reduce:transition-none lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`} aria-label="Navegación administrativa">
        <div className="flex h-20 items-center justify-between px-6"><Link to="/admin" className="font-display text-2xl font-bold">Beca<span className="text-accent">Match</span></Link><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Cerrar menú" onClick={() => setOpen(false)}><X /></Button></div>
        <p className="px-6 text-xs text-sidebar-foreground/60">ESPACIO ADMINISTRATIVO</p>
        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-7">{groups.map(group => <div key={group.label}><p className="mb-2 px-3 text-xs font-medium uppercase text-sidebar-foreground/50">{group.label}</p><div className="space-y-1">{group.links.map(({ to, label, icon: Icon }) => <Link key={to} to={to} activeOptions={{ exact: true }} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" }}><Icon className="size-4 shrink-0" />{label}</Link>)}</div></div>)}</nav>
        <Link to="/mazo" className="m-3 flex items-center justify-between border-t border-sidebar-border px-3 py-4 text-sm text-sidebar-foreground/70">Espacio del estudiante<ArrowUpRight className="size-4" /></Link>
      </aside>
      <div className="min-w-0 lg:pl-64"><header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-8"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú administrativo" onClick={() => setOpen(true)}><Menu /></Button><div><p className="text-xs text-muted-foreground">Administración / BecaMatch</p><h1 className="text-xl font-semibold">{title}</h1></div></div><AccountMenu isAdmin administrative /></header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8"><Outlet /></main></div>
    </div>
  );
}
