CREATE TABLE public.privacy_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
 source text NOT NULL CHECK (source IN ('registro','perfil','formulario','agente')),
 source_id uuid, policy_version text NOT NULL CHECK (policy_version='demo-1.0-2026-10-24'),
 purpose text NOT NULL CHECK (purpose IN ('servicio','promociones_email','promociones_whatsapp')),
 granted boolean NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.privacy_consents TO authenticated;
GRANT ALL ON public.privacy_consents TO service_role;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own consents" ON public.privacy_consents FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE INDEX privacy_consents_owner ON public.privacy_consents(user_id,purpose,recorded_at DESC);
CREATE OR REPLACE FUNCTION public.record_my_privacy_consent(policy text, legal boolean, email_promotions boolean DEFAULT false, whatsapp_promotions boolean DEFAULT false, origin text DEFAULT 'perfil') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF policy IS DISTINCT FROM 'demo-1.0-2026-10-24' OR legal IS DISTINCT FROM true OR origin NOT IN ('registro','perfil') THEN RAISE EXCEPTION 'Current affirmative consent required'; END IF;
 INSERT INTO public.privacy_consents(user_id,source,policy_version,purpose,granted) VALUES
 (auth.uid(),origin,policy,'servicio',true),(auth.uid(),origin,policy,'promociones_email',email_promotions),(auth.uid(),origin,policy,'promociones_whatsapp',whatsapp_promotions);
END; $$;
REVOKE ALL ON FUNCTION public.record_my_privacy_consent(text,boolean,boolean,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_my_privacy_consent(text,boolean,boolean,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.capture_signup_privacy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(NEW.encrypted_password,'')<>'' AND NEW.email_confirmed_at IS NULL AND (NEW.raw_user_meta_data->>'privacy_version' IS DISTINCT FROM 'demo-1.0-2026-10-24' OR NEW.raw_user_meta_data->>'privacy_accepted' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'Current affirmative consent required'; END IF;
 IF NEW.raw_user_meta_data->>'privacy_version'='demo-1.0-2026-10-24' AND NEW.raw_user_meta_data->>'privacy_accepted'='true' THEN
 INSERT INTO public.privacy_consents(user_id,source,policy_version,purpose,granted) VALUES
 (NEW.id,'registro','demo-1.0-2026-10-24','servicio',true),
 (NEW.id,'registro','demo-1.0-2026-10-24','promociones_email',coalesce(NEW.raw_user_meta_data->>'promotions_email','false')='true'),
 (NEW.id,'registro','demo-1.0-2026-10-24','promociones_whatsapp',coalesce(NEW.raw_user_meta_data->>'promotions_whatsapp','false')='true');
 END IF; RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.capture_signup_privacy() FROM PUBLIC;
CREATE TRIGGER capture_signup_privacy AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.capture_signup_privacy();
CREATE OR REPLACE FUNCTION public.require_profile_privacy() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.privacy_consents WHERE user_id=NEW.id AND purpose='servicio' AND granted AND policy_version='demo-1.0-2026-10-24') THEN RAISE EXCEPTION 'Current affirmative consent required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER require_profile_privacy BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.require_profile_privacy();
ALTER TABLE public.postulation_requests ADD COLUMN privacy_version text, ADD COLUMN privacy_accepted boolean NOT NULL DEFAULT false, ADD COLUMN promotions_email boolean NOT NULL DEFAULT false, ADD COLUMN promotions_whatsapp boolean NOT NULL DEFAULT false;
ALTER TABLE public.web_agent_conversations ADD COLUMN privacy_version text, ADD COLUMN privacy_accepted boolean NOT NULL DEFAULT false, ADD COLUMN promotions_email boolean NOT NULL DEFAULT false, ADD COLUMN promotions_whatsapp boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.capture_contact_privacy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE origin text;
BEGIN
 IF NEW.privacy_version IS DISTINCT FROM 'demo-1.0-2026-10-24' OR NEW.privacy_accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Current affirmative consent required'; END IF;
 origin:=CASE WHEN TG_TABLE_NAME='postulation_requests' THEN 'formulario' ELSE 'agente' END;
 INSERT INTO public.privacy_consents(user_id,source,source_id,policy_version,purpose,granted) VALUES
 (NEW.user_id,origin,NEW.id,NEW.privacy_version,'servicio',true),
 (NEW.user_id,origin,NEW.id,NEW.privacy_version,'promociones_email',NEW.promotions_email),
 (NEW.user_id,origin,NEW.id,NEW.privacy_version,'promociones_whatsapp',NEW.promotions_whatsapp);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.capture_contact_privacy() FROM PUBLIC;
CREATE TRIGGER capture_form_privacy AFTER INSERT ON public.postulation_requests FOR EACH ROW EXECUTE FUNCTION public.capture_contact_privacy();
CREATE TRIGGER capture_agent_privacy AFTER INSERT ON public.web_agent_conversations FOR EACH ROW EXECUTE FUNCTION public.capture_contact_privacy();