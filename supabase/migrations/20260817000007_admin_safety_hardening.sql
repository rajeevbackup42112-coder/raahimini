-- RAAHI MINI — ADMIN SAFETY HARDENING
-- Keeps Admin exceptional actions behind canonical, audited RPCs while
-- preserving the same queue/trip/seat invariants as ordinary operations.

-- Configuration tables are publicly readable, but never directly writable.
-- RLS is not a substitute for revoking non-row-scoped privileges such as TRUNCATE.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.locations, public.routes, public.route_stops, public.vehicles
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.locations, public.routes, public.route_stops, public.vehicles
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id=auth.uid() AND role='admin' AND is_restricted=false
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Queue state is visible only to an active driver or an unrestricted admin.
CREATE OR REPLACE FUNCTION public.get_driver_queue_status(p_route_id UUID)
RETURNS TABLE(
  queue_id UUID, driver_id UUID, driver_name TEXT, vehicle_number TEXT,
  queue_position INTEGER, status TEXT, joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.drivers d
      JOIN public.profiles p ON p.id=d.profile_id
      WHERE d.profile_id=auth.uid() AND d.is_active=true
        AND p.role='driver' AND p.is_restricted=false
    )
  ) THEN
    RAISE EXCEPTION 'Active driver or admin access required';
  END IF;

  RETURN QUERY
  SELECT dq.id, d.id, d.display_name, v.registration_number,
         ROW_NUMBER() OVER(
           ORDER BY CASE WHEN dq.status='ACTIVE_COLLECTING' THEN 0 ELSE 1 END,
                    dq.queue_position,dq.joined_at,dq.id
         )::INTEGER,
         dq.status::TEXT, dq.joined_at
  FROM public.driver_queue dq
  JOIN public.drivers d ON d.id=dq.driver_id
  LEFT JOIN public.vehicles v ON v.id=d.vehicle_id
  WHERE dq.route_id=p_route_id AND dq.status IN('WAITING','ACTIVE_COLLECTING')
  ORDER BY 5;
END;
$$;
REVOKE ALL ON FUNCTION public.get_driver_queue_status(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_driver_queue_status(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_restrict_user(p_user_id UUID,p_reason TEXT DEFAULT '')
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
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

  UPDATE public.profiles SET is_restricted=true,restriction_reason=trim(COALESCE(p_reason,'')),updated_at=now()
  WHERE id=p_user_id;
  PERFORM public.record_audit('admin_restrict_user','profiles',p_user_id,
    jsonb_build_object('is_restricted',v_profile.is_restricted,'restriction_reason',v_profile.restriction_reason),
    jsonb_build_object('is_restricted',true,'restriction_reason',trim(COALESCE(p_reason,''))));
  RETURN jsonb_build_object('success',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unrestrict_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
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

CREATE OR REPLACE FUNCTION public.admin_onboard_driver(
  p_profile_id UUID,p_driver_name TEXT,p_phone TEXT,p_registration_number TEXT,
  p_vehicle_model TEXT,p_vehicle_type TEXT DEFAULT 'Car',p_capacity INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
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
  IF p_capacity NOT IN(4,6,8) THEN RETURN jsonb_build_object('success',false,'error','Seat capacity must be 4, 6, or 8'); END IF;

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

  -- Profile phone remains an Auth-confirmed identity attribute; driver contact is admin-verified separately.
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
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_from_queue(p_queue_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_entry public.driver_queue; v_active_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RETURN jsonb_build_object('success',false,'error','Admin access required'); END IF;
  SELECT * INTO v_entry FROM public.driver_queue WHERE id=p_queue_id;
  IF v_entry.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Queue entry not found'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('route:'||v_entry.route_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_entry.route_id::text,0));
  SELECT * INTO v_entry FROM public.driver_queue WHERE id=p_queue_id AND status='WAITING' FOR UPDATE;
  IF v_entry.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Queue entry is no longer WAITING'); END IF;
  PERFORM 1 FROM public.driver_queue WHERE route_id=v_entry.route_id AND status IN('WAITING','ACTIVE_COLLECTING') FOR UPDATE;
  UPDATE public.driver_queue SET status='CANCELLED' WHERE id=p_queue_id;
  SELECT count(*) INTO v_active_count FROM public.driver_queue WHERE route_id=v_entry.route_id AND status='ACTIVE_COLLECTING';
  WITH ranked AS (
    SELECT id,ROW_NUMBER() OVER(ORDER BY queue_position,joined_at,id)::INTEGER rn
    FROM public.driver_queue WHERE route_id=v_entry.route_id AND status='WAITING'
  ) UPDATE public.driver_queue q SET queue_position=-100000-ranked.rn FROM ranked WHERE q.id=ranked.id;
  UPDATE public.driver_queue SET queue_position=1 WHERE route_id=v_entry.route_id AND status='ACTIVE_COLLECTING';
  UPDATE public.driver_queue SET queue_position=v_active_count+(-queue_position-100000)
    WHERE route_id=v_entry.route_id AND status='WAITING';
  PERFORM public.record_audit('admin_remove_from_queue','driver_queue',p_queue_id,to_jsonb(v_entry),jsonb_build_object('status','CANCELLED'));
  RETURN jsonb_build_object('success',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reorder_queue(p_queue_id UUID,p_new_position INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_entry public.driver_queue; v_active_count INTEGER; v_waiting_count INTEGER; v_waiting_rank INTEGER;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RETURN jsonb_build_object('success',false,'error','Admin access required'); END IF;
  SELECT * INTO v_entry FROM public.driver_queue WHERE id=p_queue_id;
  IF v_entry.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Queue entry not found'); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('route:'||v_entry.route_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_entry.route_id::text,0));
  SELECT * INTO v_entry FROM public.driver_queue WHERE id=p_queue_id AND status='WAITING' FOR UPDATE;
  IF v_entry.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Queue entry is no longer WAITING'); END IF;
  PERFORM 1 FROM public.driver_queue WHERE route_id=v_entry.route_id AND status IN('WAITING','ACTIVE_COLLECTING') FOR UPDATE;
  SELECT count(*) INTO v_active_count FROM public.driver_queue WHERE route_id=v_entry.route_id AND status='ACTIVE_COLLECTING';
  SELECT count(*) INTO v_waiting_count FROM public.driver_queue WHERE route_id=v_entry.route_id AND status='WAITING';
  IF p_new_position IS NULL OR p_new_position<v_active_count+1 OR p_new_position>v_active_count+v_waiting_count THEN
    RETURN jsonb_build_object('success',false,'error','New position is outside the live waiting queue');
  END IF;
  v_waiting_rank:=p_new_position-v_active_count;
  WITH others AS (
    SELECT id,ROW_NUMBER() OVER(ORDER BY queue_position,joined_at,id)::INTEGER rn
    FROM public.driver_queue WHERE route_id=v_entry.route_id AND status='WAITING' AND id<>p_queue_id
  ), desired AS (
    SELECT id,CASE WHEN rn<v_waiting_rank THEN rn ELSE rn+1 END AS rn FROM others
    UNION ALL SELECT p_queue_id,v_waiting_rank
  ) UPDATE public.driver_queue q SET queue_position=-100000-desired.rn FROM desired WHERE q.id=desired.id;
  UPDATE public.driver_queue SET queue_position=1 WHERE route_id=v_entry.route_id AND status='ACTIVE_COLLECTING';
  UPDATE public.driver_queue SET queue_position=v_active_count+(-queue_position-100000)
    WHERE route_id=v_entry.route_id AND status='WAITING';
  PERFORM public.record_audit('admin_reorder_queue','driver_queue',p_queue_id,to_jsonb(v_entry),jsonb_build_object('new_position',p_new_position));
  RETURN jsonb_build_object('success',true);
END;
$$;

-- Reassert the intended Admin-only command grants after replacement.
REVOKE ALL ON FUNCTION public.admin_restrict_user(UUID,TEXT) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_unrestrict_user(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_onboard_driver(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_remove_from_queue(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_reorder_queue(UUID,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_restrict_user(UUID,TEXT), public.admin_unrestrict_user(UUID),
  public.admin_onboard_driver(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER),
  public.admin_remove_from_queue(UUID), public.admin_reorder_queue(UUID,INTEGER)
  TO authenticated;

