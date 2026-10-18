CREATE TABLE public.applicant_followups (
 person_key text PRIMARY KEY,
 stage text NOT NULL DEFAULT 'nuevo' CHECK (stage IN ('nuevo','contactado','preparando','seguimiento','ganado','perdido')),
 next_action text NOT NULL DEFAULT '',
 followup_at timestamptz,
 assigned_to uuid,
 objective text NOT NULL DEFAULT '',
 response_resolved_at timestamptz,
 updated_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (stage <> 'ganado' OR length(trim(objective)) > 0)
);
GRANT SELECT, INSERT, UPDATE ON public.applicant_followups TO authenticated;
GRANT ALL ON public.applicant_followups TO service_role;
ALTER TABLE public.applicant_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin followups" ON public.applicant_followups FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.applicant_calls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 full_name text NOT NULL DEFAULT '',
 user_id uuid,
 occurred_at timestamptz NOT NULL,
 notes text NOT NULL,
 requires_response boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.applicant_calls TO authenticated;
GRANT ALL ON public.applicant_calls TO service_role;
ALTER TABLE public.applicant_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read calls" ON public.applicant_calls FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins record calls" ON public.applicant_calls FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND created_by=auth.uid());
CREATE TABLE public.applicant_identity_links (
 source_key text PRIMARY KEY,
 target_key text NOT NULL,
 evidence text NOT NULL,
 reviewed_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (source_key <> target_key),
 CHECK (length(trim(evidence)) >= 10)
);
GRANT SELECT, INSERT ON public.applicant_identity_links TO authenticated;
GRANT ALL ON public.applicant_identity_links TO service_role;
ALTER TABLE public.applicant_identity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read identity reviews" ON public.applicant_identity_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins confirm identity" ON public.applicant_identity_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND reviewed_by=auth.uid());
CREATE TABLE public.applicant_followup_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 record_type text NOT NULL,
 record_key text NOT NULL,
 actor_id uuid NOT NULL,
 before_data jsonb,
 after_data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.applicant_followup_audit TO authenticated;
GRANT ALL ON public.applicant_followup_audit TO service_role;
ALTER TABLE public.applicant_followup_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read followup audit" ON public.applicant_followup_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.audit_applicant_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid; key text;
BEGIN
 IF TG_TABLE_NAME='applicant_followups' THEN actor:=NEW.updated_by; key:=NEW.person_key;
 ELSIF TG_TABLE_NAME='applicant_calls' THEN actor:=NEW.created_by; key:=NEW.id::text;
 ELSE actor:=NEW.reviewed_by; key:=NEW.source_key; END IF;
 INSERT INTO public.applicant_followup_audit(record_type,record_key,actor_id,before_data,after_data)
 VALUES(TG_TABLE_NAME,key,actor,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END; $$;
CREATE TRIGGER audit_followups AFTER INSERT OR UPDATE ON public.applicant_followups FOR EACH ROW EXECUTE FUNCTION public.audit_applicant_change();
CREATE TRIGGER audit_calls AFTER INSERT ON public.applicant_calls FOR EACH ROW EXECUTE FUNCTION public.audit_applicant_change();
CREATE TRIGGER audit_identity_links AFTER INSERT ON public.applicant_identity_links FOR EACH ROW EXECUTE FUNCTION public.audit_applicant_change();