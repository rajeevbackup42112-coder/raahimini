-- Final hardening found by the live Supabase advisor pass.
-- Trigger helpers never need to resolve caller-controlled schemas.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
