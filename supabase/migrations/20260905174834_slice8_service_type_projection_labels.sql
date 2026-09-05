-- Slice 8G: expose service type in existing Fixed product/workspace projections.

do $$
declare
  v_sig regprocedure;
  v_def text;
  v_next text;
begin
  foreach v_sig in array array[
    'private.get_fixed_product_detail(uuid)'::regprocedure,
    'private.get_fixed_driver_workspace()'::regprocedure
  ] loop
    v_def := pg_get_functiondef(v_sig);
    v_next := replace(
      v_def,
      '''product_code'', p.code,',
      '''product_code'', p.code,''service_type'', p.service_type,'
    );
    if v_next = v_def then
      raise exception 'FIXED_SERVICE_TYPE_PROJECTION_ANCHOR_NOT_FOUND: %', v_sig;
    end if;
    execute v_next;
  end loop;
end;
$$;