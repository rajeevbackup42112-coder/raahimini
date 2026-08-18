-- ============================================================
-- RAAHI MINI — MIGRATION 15: ADMIN DRIVER ONBOARDING
-- Drivers are few/known personally; admin provisions trusted driver identities.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_driver_candidates()
RETURNS TABLE(
  profile_id UUID,
  display_name TEXT,
  phone TEXT,
  role TEXT,
  is_restricted BOOLEAN,
  driver_id UUID,
  driver_phone TEXT,
  driver_name TEXT,
  vehicle_id UUID,
  registration_number TEXT,
  vehicle_model TEXT,
  capacity INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  RETURN QUERY
  SELECT p.id,p.display_name,p.phone,p.role::TEXT,p.is_restricted,
         d.id,d.phone,d.display_name,v.id,v.registration_number,v.vehicle_model,v.capacity
  FROM public.profiles p
  LEFT JOIN public.drivers d ON d.profile_id=p.id
  LEFT JOIN public.vehicles v ON v.id=d.vehicle_id
  WHERE p.role <> 'admin'
  ORDER BY (d.id IS NOT NULL) DESC,p.display_name,p.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_onboard_driver(
  p_profile_id UUID,
  p_driver_name TEXT,
  p_phone TEXT,
  p_registration_number TEXT,
  p_vehicle_model TEXT,
  p_vehicle_type TEXT DEFAULT 'Car',
  p_capacity INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_profile public.profiles;
  v_vehicle_id UUID;
  v_driver_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','Admin access required');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','User must sign in to Raahi at least once before driver onboarding');
  END IF;
  IF v_profile.role='admin' THEN
    RETURN jsonb_build_object('success',false,'error','Admin account cannot be converted to driver');
  END IF;
  IF v_profile.is_restricted THEN
    RETURN jsonb_build_object('success',false,'error','Restricted user cannot be onboarded as driver');
  END IF;
  IF length(trim(COALESCE(p_driver_name,'')))<2 THEN
    RETURN jsonb_build_object('success',false,'error','Driver name is required');
  END IF;
  IF length(regexp_replace(COALESCE(p_phone,''),'\D','','g'))<10 THEN
    RETURN jsonb_build_object('success',false,'error','Valid driver phone is required');
  END IF;
  IF length(trim(COALESCE(p_registration_number,'')))<4 THEN
    RETURN jsonb_build_object('success',false,'error','Vehicle registration number is required');
  END IF;
  IF length(trim(COALESCE(p_vehicle_model,'')))<2 THEN
    RETURN jsonb_build_object('success',false,'error','Vehicle model is required');
  END IF;
  IF p_capacity NOT IN (4,6,8) THEN
    RETURN jsonb_build_object('success',false,'error','Seat capacity must be 4, 6, or 8');
  END IF;

  INSERT INTO public.vehicles(registration_number,vehicle_type,vehicle_model,capacity,is_active)
  VALUES(upper(trim(p_registration_number)),COALESCE(NULLIF(trim(p_vehicle_type),''),'Car'),trim(p_vehicle_model),p_capacity,true)
  ON CONFLICT(registration_number) DO UPDATE
    SET vehicle_type=EXCLUDED.vehicle_type,
        vehicle_model=EXCLUDED.vehicle_model,
        capacity=EXCLUDED.capacity,
        is_active=true
  RETURNING id INTO v_vehicle_id;

  UPDATE public.profiles
  SET role='driver',display_name=trim(p_driver_name),phone=p_phone,updated_at=now()
  WHERE id=p_profile_id;

  INSERT INTO public.drivers(profile_id,vehicle_id,display_name,phone,is_active)
  VALUES(p_profile_id,v_vehicle_id,trim(p_driver_name),p_phone,true)
  ON CONFLICT(profile_id) DO UPDATE
    SET vehicle_id=EXCLUDED.vehicle_id,
        display_name=EXCLUDED.display_name,
        phone=EXCLUDED.phone,
        is_active=true,
        updated_at=now()
  RETURNING id INTO v_driver_id;

  PERFORM public.record_audit(
    'admin_onboard_driver','drivers',v_driver_id,NULL,
    jsonb_build_object(
      'profile_id',p_profile_id,
      'vehicle_id',v_vehicle_id,
      'registration_number',upper(trim(p_registration_number)),
      'capacity',p_capacity
    ),NULL
  );

  RETURN jsonb_build_object(
    'success',true,
    'driver_id',v_driver_id,
    'profile_id',p_profile_id,
    'vehicle_id',v_vehicle_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_driver(p_driver_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_driver public.drivers;
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('success',false,'error','Admin access required'); END IF;
  SELECT * INTO v_driver FROM public.drivers WHERE id=p_driver_id FOR UPDATE;
  IF v_driver.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Driver not found'); END IF;
  IF EXISTS(SELECT 1 FROM public.trips WHERE driver_id=p_driver_id AND status IN('ACTIVE_COLLECTING','IN_PROGRESS')) THEN
    RETURN jsonb_build_object('success',false,'error','Cannot deactivate driver with an active trip');
  END IF;
  UPDATE public.driver_queue SET status='CANCELLED'
  WHERE driver_id=p_driver_id AND status IN('WAITING','ACTIVE_COLLECTING');
  UPDATE public.drivers SET is_active=false,updated_at=now() WHERE id=p_driver_id;
  UPDATE public.profiles SET role='passenger',updated_at=now() WHERE id=v_driver.profile_id;
  PERFORM public.record_audit('admin_deactivate_driver','drivers',p_driver_id);
  RETURN jsonb_build_object('success',true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_driver_candidates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_driver_candidates() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_onboard_driver(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_onboard_driver(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_deactivate_driver(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_driver(UUID) TO authenticated;
