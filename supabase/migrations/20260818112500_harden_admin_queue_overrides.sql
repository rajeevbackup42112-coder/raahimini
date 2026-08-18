CREATE OR REPLACE FUNCTION public.admin_remove_from_queue(p_queue_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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

REVOKE ALL ON FUNCTION public.admin_remove_from_queue(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_reorder_queue(UUID,INTEGER) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_from_queue(UUID), public.admin_reorder_queue(UUID,INTEGER) TO authenticated;
