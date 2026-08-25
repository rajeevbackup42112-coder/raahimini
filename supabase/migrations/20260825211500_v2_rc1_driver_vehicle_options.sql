-- Raahi 2.0 RC1: align Admin driver onboarding with accepted vehicle capacities.
-- Existing operational guards, audit recording, and role transition rules remain unchanged.

CREATE OR REPLACE FUNCTION public.admin_onboard_driver(
  p_profile_id uuid,
  p_driver_name text,
  p_phone text,
  p_registration_number text,
  p_vehicle_model text,
  p_vehicle_type text DEFAULT 'Car'::text,
  p_capacity integer DEFAULT 4
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles; v_existing_driver public.drivers;
  v_vehicle_id UUID; v_driver_id UUID; v_registration TEXT;
BEGIN
  IF NOT public.is_admin() THEN RETURN jsonb_build_object('success',false,'error','Admin access required'); END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=p_profile_id FOR UPDATE;
  IF v_profile.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','User must sign in to Raahi at least once before driver onboarding'); END IF;
  IF v_profile.role='admin' THEN RETURN jsonb_build_object('success',false,'error','Admin account cannot be converted to driver'); END IF;
  IF v_profile.is_restricted THEN RETURN jsonb_build_object('success',false,'error','Restricted user cannot be onboarded as driver'); END IF;
  IF length(trim(COALESCE(p_driver_name,'')))<2 THEN RETURN jsonb_build_object('success',false,'error','Driver name is required'); END IF;
  IF length(regexp_replace(COALESCE(p_phone,''),'\D','','g'))<10 THEN RETURN jsonb_build_object('success',false,'error','Valid driver phone is required'); END IF;
  IF length(trim(COALESCE(p_registration_number,'')))<4 THEN RETURN jsonb_build_object('success',false,'error','Vehicle registration number is required'); END IF;
  IF length(trim(COALESCE(p_vehicle_model,'')))<2 THEN RETURN jsonb_build_object('success',false,'error','Vehicle model is required'); END IF;
  IF p_capacity NOT IN(4,5,6,7,8) THEN RETURN jsonb_build_object('success',false,'error','Seat capacity must be between 4 and 8'); END IF;

  SELECT * INTO v_existing_driver FROM public.drivers WHERE profile_id=p_profile_id FOR UPDATE;
  IF v_existing_driver.id IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.driver_queue WHERE driver_id=v_existing_driver.id AND status IN('WAITING','ACTIVE_COLLECTING')) OR
    EXISTS(SELECT 1 FROM public.trips WHERE driver_id=v_existing_driver.id AND status IN('ACTIVE_COLLECTING','IN_PROGRESS'))
  ) THEN
    RETURN jsonb_build_object('success',false,'error','Cannot change driver or vehicle while queued or on a live trip');
  END IF;

  v_registration:=upper(trim(p_registration_number));
  SELECT id INTO v_vehicle_id FROM public.vehicles WHERE registration_number=v_registration FOR UPDATE;
  IF v_vehicle_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.drivers d
    WHERE d.vehicle_id=v_vehicle_id AND d.is_active=true AND d.profile_id<>p_profile_id
  ) THEN
    RETURN jsonb_build_object('success',false,'error','Vehicle is already assigned to another active driver');
  END IF;
  IF v_vehicle_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.trips t JOIN public.drivers d ON d.id=t.driver_id
    WHERE t.vehicle_id=v_vehicle_id AND t.status IN('ACTIVE_COLLECTING','IN_PROGRESS') AND d.profile_id<>p_profile_id
  ) THEN
    RETURN jsonb_build_object('success',false,'error','Vehicle is attached to another live trip');
  END IF;

  INSERT INTO public.vehicles(registration_number,vehicle_type,vehicle_model,capacity,is_active)
  VALUES(v_registration,COALESCE(NULLIF(trim(p_vehicle_type),''),'Car'),trim(p_vehicle_model),p_capacity,true)
  ON CONFLICT(registration_number) DO UPDATE SET vehicle_type=EXCLUDED.vehicle_type,
    vehicle_model=EXCLUDED.vehicle_model,capacity=EXCLUDED.capacity,is_active=true
  RETURNING id INTO v_vehicle_id;

  UPDATE public.profiles SET role='driver',display_name=trim(p_driver_name),updated_at=now() WHERE id=p_profile_id;
  INSERT INTO public.drivers(profile_id,vehicle_id,display_name,phone,is_active)
  VALUES(p_profile_id,v_vehicle_id,trim(p_driver_name),p_phone,true)
  ON CONFLICT(profile_id) DO UPDATE SET vehicle_id=EXCLUDED.vehicle_id,display_name=EXCLUDED.display_name,
    phone=EXCLUDED.phone,is_active=true,updated_at=now()
  RETURNING id INTO v_driver_id;

  PERFORM public.record_audit('admin_onboard_driver','drivers',v_driver_id,
    CASE WHEN v_existing_driver.id IS NULL THEN NULL ELSE to_jsonb(v_existing_driver) END,
    jsonb_build_object('profile_id',p_profile_id,'vehicle_id',v_vehicle_id,'registration_number',v_registration,'capacity',p_capacity));
  RETURN jsonb_build_object('success',true,'driver_id',v_driver_id,'profile_id',p_profile_id,'vehicle_id',v_vehicle_id);
END;
$function$;
