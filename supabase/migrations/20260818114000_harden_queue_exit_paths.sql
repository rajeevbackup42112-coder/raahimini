CREATE OR REPLACE FUNCTION public.leave_driver_queue(p_route_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_driver public.drivers;
  v_profile public.profiles;
  v_queue_entry public.driver_queue;
  v_active_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Not authenticated');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id=auth.uid();
  IF v_profile.id IS NULL OR v_profile.role<>'driver' OR v_profile.is_restricted THEN
    RETURN jsonb_build_object('success',false,'error','Active driver account required');
  END IF;

  SELECT * INTO v_driver FROM public.drivers WHERE profile_id=auth.uid() AND is_active=true FOR UPDATE;
  IF v_driver.id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Active driver record required');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('driver:'||v_driver.id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('route:'||p_route_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_route_id::text,0));

  SELECT * INTO v_queue_entry
  FROM public.driver_queue
  WHERE driver_id=v_driver.id AND route_id=p_route_id AND status='WAITING'
  FOR UPDATE;

  IF v_queue_entry.id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Not in waiting queue for this route');
  END IF;

  PERFORM 1 FROM public.driver_queue
  WHERE route_id=p_route_id AND status IN('WAITING','ACTIVE_COLLECTING') FOR UPDATE;

  UPDATE public.driver_queue SET status='CANCELLED' WHERE id=v_queue_entry.id;
  SELECT count(*) INTO v_active_count FROM public.driver_queue WHERE route_id=p_route_id AND status='ACTIVE_COLLECTING';

  WITH ranked AS (
    SELECT id,row_number() over(order by queue_position,joined_at,id)::integer rn
    FROM public.driver_queue WHERE route_id=p_route_id AND status='WAITING'
  ) UPDATE public.driver_queue q SET queue_position=-100000-ranked.rn FROM ranked WHERE q.id=ranked.id;

  UPDATE public.driver_queue SET queue_position=1 WHERE route_id=p_route_id AND status='ACTIVE_COLLECTING';
  UPDATE public.driver_queue SET queue_position=v_active_count+(-queue_position-100000)
  WHERE route_id=p_route_id AND status='WAITING';

  PERFORM public.record_audit('leave_driver_queue','driver_queue',v_queue_entry.id,to_jsonb(v_queue_entry),jsonb_build_object('status','CANCELLED'));
  RETURN jsonb_build_object('success',true);
END;
$$;
REVOKE ALL ON FUNCTION public.leave_driver_queue(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leave_driver_queue(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_deactivate_driver(p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_driver public.drivers;
  v_queue_id uuid;
  v_remove jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success',false,'error','Admin access required');
  END IF;

  SELECT * INTO v_driver FROM public.drivers WHERE id=p_driver_id FOR UPDATE;
  IF v_driver.id IS NULL THEN RETURN jsonb_build_object('success',false,'error','Driver not found'); END IF;

  IF EXISTS(SELECT 1 FROM public.trips WHERE driver_id=p_driver_id AND status IN('ACTIVE_COLLECTING','IN_PROGRESS')) THEN
    RETURN jsonb_build_object('success',false,'error','Cannot deactivate driver with an active trip');
  END IF;

  SELECT id INTO v_queue_id FROM public.driver_queue
  WHERE driver_id=p_driver_id AND status='WAITING'
  ORDER BY joined_at,id LIMIT 1;

  IF v_queue_id IS NOT NULL THEN
    SELECT public.admin_remove_from_queue(v_queue_id) INTO v_remove;
    IF COALESCE((v_remove->>'success')::boolean,false)=false THEN
      RETURN jsonb_build_object('success',false,'error',COALESCE(v_remove->>'error','Could not remove driver from queue'));
    END IF;
  END IF;

  UPDATE public.drivers SET is_active=false,updated_at=now() WHERE id=p_driver_id;
  UPDATE public.profiles SET role='passenger',updated_at=now() WHERE id=v_driver.profile_id;
  PERFORM public.record_audit('admin_deactivate_driver','drivers',p_driver_id,to_jsonb(v_driver),jsonb_build_object('is_active',false,'profile_role','passenger'));
  RETURN jsonb_build_object('success',true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_deactivate_driver(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_driver(uuid) TO authenticated;
