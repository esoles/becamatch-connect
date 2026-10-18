import { Link } from "@tanstack/react-router";
import { CircleUserRound, LogOut, ShieldCheck, UserRound, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
export function AccountMenu({ isAdmin = false, administrative = false }: { isAdmin?: boolean; administrative?: boolean }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Menú de cuenta" title="Mi cuenta"><CircleUserRound /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end"><DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
      <DropdownMenuItem asChild><Link to="/perfil"><UserRound />Mi perfil y preferencias</Link></DropdownMenuItem>
      {isAdmin && !administrative && <DropdownMenuItem asChild><Link to="/admin"><ShieldCheck />Administración</Link></DropdownMenuItem>}
      {administrative && <DropdownMenuItem asChild><Link to="/mazo"><ArrowLeft />Espacio del estudiante</Link></DropdownMenuItem>}
      <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void supabase.auth.signOut().then(() => window.location.assign("/"))}><LogOut />Cerrar sesión</DropdownMenuItem>
    </DropdownMenuContent></DropdownMenu>;
}