-- Raahi V2 alpha1: canonical self-service display-name update.
-- Does not permit role, restriction, phone or auth identity changes.

CREATE OR REPLACE FUNCTION public.set_my_display_name(p_display_name TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
REVOKE ALL ON FUNCTION public.set_my_display_name(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_my_display_name(TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_my_display_name(TEXT) IS
  'Authenticated user updates only their own Raahi display name; role and trust fields remain server-controlled.';

-- Mirror phone from Supabase Auth; the client cannot choose the stored value.
CREATE OR REPLACE FUNCTION public.sync_my_profile_phone()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(u.phone, '')
  INTO v_phone
  FROM auth.users AS u
  WHERE u.id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth user not found';
  END IF;

  UPDATE public.profiles
  SET phone = v_phone
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_phone;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_profile_phone() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_my_profile_phone() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_my_profile_phone() TO authenticated;

COMMENT ON FUNCTION public.sync_my_profile_phone() IS
  'Authenticated user mirrors their current Supabase Auth phone into their own Raahi profile; browser input is not trusted.';
