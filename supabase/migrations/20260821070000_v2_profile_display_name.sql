-- Raahi V2 alpha1: canonical self-service display-name update.
-- Does not permit role, restriction, phone or auth identity changes.

CREATE OR REPLACE FUNCTION public.set_my_display_name(p_display_name TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := btrim(COALESCE(p_display_name, ''));
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'Display name must be between 2 and 40 characters';
  END IF;

  UPDATE public.profiles
  SET display_name = v_name
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_display_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_display_name(TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_my_display_name(TEXT) IS
  'Authenticated user updates only their own Raahi display name; role and trust fields remain server-controlled.';
