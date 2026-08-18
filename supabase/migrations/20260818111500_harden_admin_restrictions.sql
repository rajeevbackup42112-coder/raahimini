CREATE OR REPLACE FUNCTION public.admin_restrict_user(p_user_id UUID,p_reason TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile public.profiles; v_driver_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','Admin access required');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','User not found'); END IF;
  IF v_profile.role='admin' THEN RETURN jsonb_build_object('success',false,'error','Admin accounts cannot be restricted'); END IF;

  SELECT id INTO v_driver_id FROM public.drivers WHERE profile_id=p_user_id;
  IF v_driver_id IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.driver_queue WHERE driver_id=v_driver_id AND status IN('WAITING','ACTIVE_COLLECTING')) OR
    EXISTS(SELECT 1 FROM public.trips WHERE driver_id=v_driver_id AND status IN('ACTIVE_COLLECTING','IN_PROGRESS'))
  ) THEN
    RETURN jsonb_build_object('success',false,'error','Cannot restrict a driver while queued or on a live trip');
  END IF;

  UPDATE public.profiles
  SET is_restricted=true,restriction_reason=trim(COALESCE(p_reason,'')),updated_at=now()
  WHERE id=p_user_id;
  PERFORM public.record_audit('admin_restrict_user','profiles',p_user_id,
    jsonb_build_object('is_restricted',v_profile.is_restricted,'restriction_reason',v_profile.restriction_reason),
    jsonb_build_object('is_restricted',true,'restriction_reason',trim(COALESCE(p_reason,''))));
  RETURN jsonb_build_object('success',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unrestrict_user(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','Admin access required');
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_user_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','User not found'); END IF;
  IF v_profile.role='admin' THEN RETURN jsonb_build_object('success',false,'error','Admin accounts cannot be changed by restriction RPCs'); END IF;

  UPDATE public.profiles SET is_restricted=false,restriction_reason=NULL,updated_at=now() WHERE id=p_user_id;
  PERFORM public.record_audit('admin_unrestrict_user','profiles',p_user_id,
    jsonb_build_object('is_restricted',v_profile.is_restricted,'restriction_reason',v_profile.restriction_reason),
    jsonb_build_object('is_restricted',false,'restriction_reason',NULL));
  RETURN jsonb_build_object('success',true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restrict_user(UUID,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_unrestrict_user(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_restrict_user(UUID,TEXT), public.admin_unrestrict_user(UUID) TO authenticated;
