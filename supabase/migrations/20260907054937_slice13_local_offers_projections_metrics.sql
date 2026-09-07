create or replace function private.local_offer_effective_status(p_status text,p_sponsorship_status text,p_valid_from timestamptz,p_valid_until timestamptz)
returns text language sql stable set search_path=''
as $$ select case
 when p_status in ('REJECTED','SUSPENDED','REMOVED') then p_status
 when p_status='PAUSED' or p_sponsorship_status='PAUSED' then 'PAUSED'
 when p_sponsorship_status='ENDED' then 'EXPIRED'
 when p_status in ('APPROVED','SCHEDULED','ACTIVE') and p_sponsorship_status='ACTIVE' and now()>=p_valid_until then 'EXPIRED'
 when p_status in ('APPROVED','SCHEDULED','ACTIVE') and p_sponsorship_status='ACTIVE' and now()<p_valid_from then 'SCHEDULED'
 when p_status in ('APPROVED','SCHEDULED','ACTIVE') and p_sponsorship_status='ACTIVE' and now()>=p_valid_from and now()<p_valid_until then 'ACTIVE'
 else p_status end; $$;
revoke all on function private.local_offer_effective_status(text,text,timestamptz,timestamptz) from public,anon,authenticated; grant execute on function private.local_offer_effective_status(text,text,timestamptz,timestamptz) to anon,authenticated;

create or replace function private.get_contextual_local_offers(p_market_id uuid,p_origin_location_id uuid,p_destination_location_id uuid,p_locality_location_id uuid,p_limit integer)
returns jsonb language plpgsql security definer stable set search_path=''
as $$ declare v_limit integer:=greatest(1,least(coalesce(p_limit,6),20)); v_result jsonb;
begin
 if p_market_id is null and p_origin_location_id is null and p_destination_location_id is null and p_locality_location_id is null then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'offer_id',q.offer_id,'sponsored',true,'sponsorship_label','Sponsored','business_id',q.business_id,'business_name',q.business_name,'business_category_code',q.business_category_code,
   'market_id',q.market_id,'market_name',q.market_name,'title',q.title,'body_text',q.body_text,'category_code',q.category_code,'cta_label',q.cta_label,'cta_url',q.cta_url,
   'origin_location_id',q.origin_location_id,'destination_location_id',q.destination_location_id,'locality_location_id',q.locality_location_id,
   'valid_from',q.valid_from,'valid_until',q.valid_until,'effective_status','ACTIVE'
 ) order by q.valid_until asc,q.created_at desc),'[]'::jsonb) into v_result
 from (
   select o.id offer_id,o.business_id,b.display_name business_name,b.category_code business_category_code,o.market_id,m.name market_name,o.title,o.body_text,o.category_code,o.cta_label,o.cta_url,o.origin_location_id,o.destination_location_id,o.locality_location_id,o.valid_from,o.valid_until,o.created_at
   from public.local_offers o join public.businesses b on b.id=o.business_id and b.status='ACTIVE'
   join public.business_market_scopes s on s.business_id=b.id and s.market_id=o.market_id and s.status='ACTIVE'
   join public.markets m on m.id=o.market_id and m.status in ('PILOT','ACTIVE','SCALING')
   where o.sponsorship_status='ACTIVE'
     and private.local_offer_effective_status(o.status,o.sponsorship_status,o.valid_from,o.valid_until)='ACTIVE'
     and (p_market_id is null or o.market_id=p_market_id)
     and (p_market_id is not null or o.market_id in (select l.market_id from public.locations l where l.id in (p_origin_location_id,p_destination_location_id,p_locality_location_id) and l.market_id is not null))
     and (o.origin_location_id is null or o.origin_location_id=p_origin_location_id)
     and (o.destination_location_id is null or o.destination_location_id=p_destination_location_id)
     and (o.locality_location_id is null or o.locality_location_id=p_locality_location_id)
   order by o.valid_until asc,o.created_at desc limit v_limit
 ) q;
 return v_result;
end; $$;
revoke all on function private.get_contextual_local_offers(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated; grant execute on function private.get_contextual_local_offers(uuid,uuid,uuid,uuid,integer) to anon,authenticated;
create or replace function public.get_contextual_local_offers(p_market_id uuid default null,p_origin_location_id uuid default null,p_destination_location_id uuid default null,p_locality_location_id uuid default null,p_limit integer default 6) returns jsonb language sql security invoker stable set search_path='' as $$ select private.get_contextual_local_offers(p_market_id,p_origin_location_id,p_destination_location_id,p_locality_location_id,p_limit); $$;
revoke all on function public.get_contextual_local_offers(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated; grant execute on function public.get_contextual_local_offers(uuid,uuid,uuid,uuid,integer) to anon,authenticated;

create or replace function private.record_local_offer_metric(p_offer_id uuid,p_metric_type text,p_surface text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb; v_metric text:=upper(trim(coalesce(p_metric_type,''))); v_surface text:=upper(trim(coalesce(p_surface,'')));
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if v_metric not in ('IMPRESSION','ENGAGEMENT') then raise exception 'OFFER_METRIC_TYPE_INVALID'; end if;
 if v_surface !~ '^[A-Z0-9_]{2,40}$' then raise exception 'OFFER_METRIC_SURFACE_INVALID'; end if;
 v_idem:=private.claim_user_command('record_local_offer_metric',p_idempotency_key,md5(p_offer_id::text||'|'||v_metric||'|'||v_surface)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 select * into v_o from public.local_offers where id=p_offer_id; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if;
 if v_o.sponsorship_status<>'ACTIVE' or private.local_offer_effective_status(v_o.status,v_o.sponsorship_status,v_o.valid_from,v_o.valid_until)<>'ACTIVE' then raise exception 'LOCAL_OFFER_NOT_ACTIVE'; end if;
 if not exists(select 1 from public.businesses b join public.business_market_scopes s on s.business_id=b.id and s.market_id=v_o.market_id and s.status='ACTIVE' where b.id=v_o.business_id and b.status='ACTIVE') then raise exception 'LOCAL_OFFER_NOT_ACTIVE'; end if;
 insert into public.local_offer_daily_metrics(offer_id,metric_date,market_id,surface,impressions,engagements)
 values(v_o.id,current_date,v_o.market_id,v_surface,case when v_metric='IMPRESSION' then 1 else 0 end,case when v_metric='ENGAGEMENT' then 1 else 0 end)
 on conflict(offer_id,metric_date,surface) do update set impressions=public.local_offer_daily_metrics.impressions+excluded.impressions,engagements=public.local_offer_daily_metrics.engagements+excluded.engagements,updated_at=now();
 v_result:=jsonb_build_object('offer_id',v_o.id,'metric_type',v_metric,'recorded',true); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.record_local_offer_metric(uuid,text,text,text) from public,anon,authenticated; grant execute on function private.record_local_offer_metric(uuid,text,text,text) to authenticated;
create or replace function public.record_local_offer_metric(p_offer_id uuid,p_metric_type text,p_surface text,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.record_local_offer_metric(p_offer_id,p_metric_type,p_surface,p_idempotency_key); $$;
revoke all on function public.record_local_offer_metric(uuid,text,text,text) from public,anon,authenticated; grant execute on function public.record_local_offer_metric(uuid,text,text,text) to authenticated;

create or replace function private.get_local_commerce_context()
returns jsonb language plpgsql security definer stable set search_path=''
as $$ declare v_uid uuid:=auth.uid(); v_result jsonb;
begin
 if v_uid is null or not private.has_capability('ADMIN') then raise exception 'ADMIN_CAPABILITY_REQUIRED'; end if;
 select jsonb_build_object('markets',coalesce(jsonb_agg(jsonb_build_object('market_id',x.id,'code',x.code,'name',x.name,'status',x.status,'state_code',x.state_code) order by x.name),'[]'::jsonb)) into v_result
 from (select distinct m.id,m.code,m.name,m.status,m.state_code from public.markets m join public.admin_scope_assignments a on a.profile_id=v_uid and a.revoked_at is null where m.status in ('PREPARING','PILOT','ACTIVE','SCALING','PAUSED') and (a.scope_type='PLATFORM' or (a.scope_type='STATE' and a.state_code=m.state_code) or (a.scope_type='MARKET' and a.market_id=m.id)) and a.permission in ('LOCAL_COMMERCE','PLATFORM_ADMIN')) x;
 return v_result;
end; $$;
revoke all on function private.get_local_commerce_context() from public,anon,authenticated; grant execute on function private.get_local_commerce_context() to authenticated;
create or replace function public.get_local_commerce_context() returns jsonb language sql security invoker stable set search_path='' as $$ select private.get_local_commerce_context(); $$;
revoke all on function public.get_local_commerce_context() from public,anon,authenticated; grant execute on function public.get_local_commerce_context() to authenticated;

create or replace function private.get_market_local_commerce(p_market_id uuid)
returns jsonb language plpgsql security definer stable set search_path=''
as $$ declare v_result jsonb;
begin
 perform private.require_local_commerce(p_market_id);
 select jsonb_build_object(
  'businesses',coalesce((select jsonb_agg(jsonb_build_object('business_id',b.id,'display_name',b.display_name,'category_code',b.category_code,'description',b.description,'address_text',b.address_text,'contact_phone',b.contact_phone,'website_url',b.website_url,'status',b.status) order by b.display_name) from public.businesses b join public.business_market_scopes s on s.business_id=b.id and s.market_id=p_market_id where s.status='ACTIVE' and b.status<>'REMOVED'),'[]'::jsonb),
  'offers',coalesce((select jsonb_agg(jsonb_build_object('offer_id',o.id,'business_id',o.business_id,'business_name',b.display_name,'title',o.title,'body_text',o.body_text,'category_code',o.category_code,'cta_label',o.cta_label,'cta_url',o.cta_url,'origin_location_id',o.origin_location_id,'destination_location_id',o.destination_location_id,'locality_location_id',o.locality_location_id,'valid_from',o.valid_from,'valid_until',o.valid_until,'status',o.status,'effective_status',private.local_offer_effective_status(o.status,o.sponsorship_status,o.valid_from,o.valid_until),'sponsorship_status',o.sponsorship_status,'review_reason',o.review_reason,'impressions',coalesce(mt.impressions,0),'engagements',coalesce(mt.engagements,0)) order by o.created_at desc) from public.local_offers o join public.businesses b on b.id=o.business_id left join lateral (select sum(d.impressions)::int impressions,sum(d.engagements)::int engagements from public.local_offer_daily_metrics d where d.offer_id=o.id) mt on true where o.market_id=p_market_id),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;
revoke all on function private.get_market_local_commerce(uuid) from public,anon,authenticated; grant execute on function private.get_market_local_commerce(uuid) to authenticated;
create or replace function public.get_market_local_commerce(p_market_id uuid) returns jsonb language sql security invoker stable set search_path='' as $$ select private.get_market_local_commerce(p_market_id); $$;
revoke all on function public.get_market_local_commerce(uuid) from public,anon,authenticated; grant execute on function public.get_market_local_commerce(uuid) to authenticated;