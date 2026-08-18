REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.locations, public.routes, public.route_stops, public.vehicles
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.locations, public.routes, public.route_stops, public.vehicles
  TO anon, authenticated;

DROP POLICY IF EXISTS trips_public_read ON public.trips;
DROP POLICY IF EXISTS trip_seats_public_read ON public.trip_seats;
DROP POLICY IF EXISTS driver_queue_public_read ON public.driver_queue;
DROP POLICY IF EXISTS vehicles_public_read ON public.vehicles;
DROP POLICY IF EXISTS vehicles_authorized_read ON public.vehicles;
REVOKE SELECT ON TABLE public.trips, public.trip_seats, public.driver_queue FROM anon, authenticated;
REVOKE SELECT ON TABLE public.vehicles FROM anon;

CREATE POLICY vehicles_authorized_read ON public.vehicles FOR SELECT TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.profile_id=auth.uid() AND d.vehicle_id=vehicles.id
  )
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id=auth.uid() AND role='admin' AND is_restricted=false
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_driver_queue_status(p_route_id UUID)
RETURNS TABLE(queue_id UUID, driver_id UUID, driver_name TEXT, vehicle_number TEXT, queue_position INTEGER, status TEXT, joined_at TIMESTAMPTZ)
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
  SELECT dq.id,d.id,d.display_name,v.registration_number,
    ROW_NUMBER() OVER(ORDER BY CASE WHEN dq.status='ACTIVE_COLLECTING' THEN 0 ELSE 1 END,dq.queue_position,dq.joined_at,dq.id)::INTEGER,
    dq.status::TEXT,dq.joined_at
  FROM public.driver_queue dq
  JOIN public.drivers d ON d.id=dq.driver_id
  LEFT JOIN public.vehicles v ON v.id=d.vehicle_id
  WHERE dq.route_id=p_route_id AND dq.status IN('WAITING','ACTIVE_COLLECTING')
  ORDER BY 5;
END;
$$;
REVOKE ALL ON FUNCTION public.get_driver_queue_status(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_driver_queue_status(UUID) TO authenticated;
