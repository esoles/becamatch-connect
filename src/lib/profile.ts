import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const scholarshipsQuery = queryOptions({
  queryKey: ["scholarships"],
  queryFn: async () => {
    const { data, error } = await supabase.from("scholarships").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const PARENTAL_LABEL: Record<string, string> = {
  no_requerida: "No requerida",
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};
