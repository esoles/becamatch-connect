CREATE FUNCTION public.validate_applicant_write() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF TG_TABLE_NAME='applicant_followups' THEN
  IF auth.uid() IS NOT NULL AND NEW.updated_by<>auth.uid() THEN RAISE EXCEPTION 'Invalid audit actor'; END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT public.has_role(NEW.assigned_to,'admin') THEN RAISE EXCEPTION 'Assignee must be admin'; END IF;
 ELSIF TG_TABLE_NAME='applicant_calls' THEN
  IF NEW.occurred_at>now() THEN RAISE EXCEPTION 'Call cannot be in the future'; END IF;
  IF length(trim(NEW.notes))<10 THEN RAISE EXCEPTION 'Call notes required'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_applicant_followups BEFORE INSERT OR UPDATE ON public.applicant_followups FOR EACH ROW EXECUTE FUNCTION public.validate_applicant_write();
CREATE TRIGGER validate_applicant_calls BEFORE INSERT ON public.applicant_calls FOR EACH ROW EXECUTE FUNCTION public.validate_applicant_write();