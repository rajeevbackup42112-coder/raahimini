REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.route_locations FROM anon, authenticated;
GRANT SELECT ON TABLE public.route_locations TO anon, authenticated;
