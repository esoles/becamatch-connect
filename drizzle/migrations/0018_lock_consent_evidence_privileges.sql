REVOKE ALL ON TABLE public.privacy_consents FROM anon,authenticated;
GRANT SELECT ON TABLE public.privacy_consents TO authenticated;
GRANT ALL ON TABLE public.privacy_consents TO service_role;
REVOKE ALL ON FUNCTION public.capture_signup_privacy() FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.capture_contact_privacy() FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.record_my_privacy_consent(text,boolean,boolean,boolean,text) FROM anon;
REVOKE ALL ON FUNCTION public.set_my_promotional_preferences(boolean,boolean) FROM anon;