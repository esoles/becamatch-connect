ALTER TABLE public.applicant_followups ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE public.applicant_followup_audit ALTER COLUMN actor_id DROP NOT NULL;
CREATE FUNCTION public.advance_plan_followup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; target text; seen text[]:=ARRAY[]::text[];
BEGIN
 IF NEW.plan_number IS NULL THEN RETURN NEW; END IF;
 IF NEW.user_id IS NOT NULL THEN k:='user:'||NEW.user_id::text;
 ELSIF NEW.request_id IS NOT NULL THEN k:='form:'||NEW.request_id::text;
 ELSIF NEW.conversation_id IS NOT NULL THEN k:='web:'||NEW.conversation_id::text;
 ELSE k:='wa:'||NEW.whatsapp_message_id::text; END IF;
 LOOP
  IF k=ANY(seen) THEN EXIT; END IF; seen:=array_append(seen,k);
  SELECT target_key INTO target FROM public.applicant_identity_links WHERE source_key=k;
  IF target IS NULL THEN EXIT; END IF; k:=target;
 END LOOP;
 INSERT INTO public.applicant_followups(person_key,stage,next_action,updated_by)
 VALUES(k,'preparando','Revisar el plan generado y confirmar los datos faltantes',NULL)
 ON CONFLICT(person_key) DO UPDATE SET stage='preparando',updated_at=now()
 WHERE public.applicant_followups.stage IN ('nuevo','contactado');
 RETURN NEW;
END; $$;
CREATE TRIGGER generated_plan_followup AFTER INSERT ON public.web_agent_plans FOR EACH ROW EXECUTE FUNCTION public.advance_plan_followup();
CREATE OR REPLACE FUNCTION public.validate_applicant_write() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF TG_TABLE_NAME='applicant_followups' THEN
  IF auth.uid() IS NOT NULL AND NEW.updated_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid audit actor'; END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT public.has_role(NEW.assigned_to,'admin') THEN RAISE EXCEPTION 'Assignee must be admin'; END IF;
 ELSIF TG_TABLE_NAME='applicant_calls' THEN
  IF NEW.occurred_at>now() THEN RAISE EXCEPTION 'Call cannot be in the future'; END IF;
  IF length(trim(NEW.notes))<10 THEN RAISE EXCEPTION 'Call notes required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.assign_plan_number() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.advance_plan_followup() FROM PUBLIC;