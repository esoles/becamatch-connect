CREATE TRIGGER renew_agent_privacy AFTER UPDATE OF privacy_version,privacy_accepted,promotions_email,promotions_whatsapp ON public.web_agent_conversations FOR EACH ROW EXECUTE FUNCTION public.capture_contact_privacy();
CREATE OR REPLACE FUNCTION public.set_my_promotional_preferences(email_promotions boolean,whatsapp_promotions boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 INSERT INTO public.privacy_consents(user_id,source,policy_version,purpose,granted) VALUES
 (auth.uid(),'perfil','demo-1.0-2026-10-24','promociones_email',email_promotions),
 (auth.uid(),'perfil','demo-1.0-2026-10-24','promociones_whatsapp',whatsapp_promotions);
END; $$;
REVOKE ALL ON FUNCTION public.set_my_promotional_preferences(boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_my_promotional_preferences(boolean,boolean) TO authenticated;