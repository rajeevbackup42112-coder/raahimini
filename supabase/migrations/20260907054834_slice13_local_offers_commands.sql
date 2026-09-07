create or replace function private.require_local_commerce(p_market_id uuid)
returns void language plpgsql security definer stable set search_path=''
as $$ begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not private.has_admin_permission('LOCAL_COMMERCE',p_market_id) then raise exception 'LOCAL_COMMERCE_SCOPE_REQUIRED'; end if;
 if not exists(select 1 from public.markets m where m.id=p_market_id and m.status in ('PREPARING','PILOT','ACTIVE','SCALING')) then raise exception 'LOCAL_COMMERCE_MARKET_NOT_AVAILABLE'; end if;
end; $$;
revoke all on function private.require_local_commerce(uuid) from public,anon,authenticated; grant execute on function private.require_local_commerce(uuid) to authenticated;

create or replace function private.admin_create_business(p_market_id uuid,p_display_name text,p_category_code text,p_description text,p_address_text text,p_contact_phone text,p_website_url text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_idem public.command_idempotency; v_business uuid; v_result jsonb; v_hash text;
begin
 perform private.require_local_commerce(p_market_id);
 v_hash:=md5(concat_ws('|',p_market_id::text,trim(coalesce(p_display_name,'')),upper(trim(coalesce(p_category_code,''))),coalesce(p_description,''),coalesce(p_address_text,''),coalesce(p_contact_phone,''),coalesce(p_website_url,'')));
 v_idem:=private.claim_user_command('admin_create_business',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 insert into public.businesses(display_name,category_code,description,address_text,contact_phone,website_url,created_by,updated_by)
 values(trim(p_display_name),upper(trim(p_category_code)),nullif(trim(coalesce(p_description,'')),''),nullif(trim(coalesce(p_address_text,'')),''),nullif(trim(coalesce(p_contact_phone,'')),''),nullif(trim(coalesce(p_website_url,'')),''),auth.uid(),auth.uid()) returning id into v_business;
 insert into public.business_market_scopes(business_id,market_id,created_by) values(v_business,p_market_id,auth.uid());
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id,metadata) values(auth.uid(),p_market_id,'BUSINESS_CREATED','BUSINESS',v_business,jsonb_build_object('category_code',upper(trim(p_category_code))));
 v_result:=jsonb_build_object('business_id',v_business,'market_id',p_market_id,'status','ACTIVE'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_create_business(uuid,text,text,text,text,text,text,text) from public,anon,authenticated; grant execute on function private.admin_create_business(uuid,text,text,text,text,text,text,text) to authenticated;
create or replace function public.admin_create_business(p_market_id uuid,p_display_name text,p_category_code text,p_description text,p_address_text text,p_contact_phone text,p_website_url text,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_create_business(p_market_id,p_display_name,p_category_code,p_description,p_address_text,p_contact_phone,p_website_url,p_idempotency_key); $$;
revoke all on function public.admin_create_business(uuid,text,text,text,text,text,text,text) from public,anon,authenticated; grant execute on function public.admin_create_business(uuid,text,text,text,text,text,text,text) to authenticated;

create or replace function private.admin_create_local_offer_draft(p_business_id uuid,p_market_id uuid,p_title text,p_body_text text,p_category_code text,p_cta_label text,p_cta_url text,p_origin_location_id uuid,p_destination_location_id uuid,p_locality_location_id uuid,p_valid_from timestamptz,p_valid_until timestamptz,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_idem public.command_idempotency; v_offer uuid; v_result jsonb; v_hash text;
begin
 perform private.require_local_commerce(p_market_id);
 if not exists(select 1 from public.businesses b join public.business_market_scopes s on s.business_id=b.id and s.market_id=p_market_id and s.status='ACTIVE' where b.id=p_business_id and b.status='ACTIVE') then raise exception 'BUSINESS_NOT_AVAILABLE_IN_MARKET'; end if;
 if p_valid_from is null or p_valid_until is null or p_valid_until<=p_valid_from or p_valid_until<=now() then raise exception 'OFFER_SCHEDULE_INVALID'; end if;
 if p_origin_location_id is not null and not exists(select 1 from public.locations where id=p_origin_location_id and is_active) then raise exception 'OFFER_CONTEXT_LOCATION_INVALID'; end if;
 if p_destination_location_id is not null and not exists(select 1 from public.locations where id=p_destination_location_id and is_active) then raise exception 'OFFER_CONTEXT_LOCATION_INVALID'; end if;
 if p_locality_location_id is not null and not exists(select 1 from public.locations where id=p_locality_location_id and is_active) then raise exception 'OFFER_CONTEXT_LOCATION_INVALID'; end if;
 v_hash:=md5(concat_ws('|',p_business_id::text,p_market_id::text,trim(coalesce(p_title,'')),trim(coalesce(p_body_text,'')),upper(trim(coalesce(p_category_code,''))),coalesce(p_cta_label,''),coalesce(p_cta_url,''),coalesce(p_origin_location_id::text,''),coalesce(p_destination_location_id::text,''),coalesce(p_locality_location_id::text,''),p_valid_from::text,p_valid_until::text));
 v_idem:=private.claim_user_command('admin_create_local_offer_draft',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 insert into public.local_offers(business_id,market_id,title,body_text,category_code,cta_label,cta_url,origin_location_id,destination_location_id,locality_location_id,valid_from,valid_until,created_by,updated_by)
 values(p_business_id,p_market_id,trim(p_title),trim(p_body_text),upper(trim(p_category_code)),nullif(trim(coalesce(p_cta_label,'')),''),nullif(trim(coalesce(p_cta_url,'')),''),p_origin_location_id,p_destination_location_id,p_locality_location_id,p_valid_from,p_valid_until,auth.uid(),auth.uid()) returning id into v_offer;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id,details) values(v_offer,'OFFER_DRAFT_CREATED',auth.uid(),jsonb_build_object('market_id',p_market_id));
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id,metadata) values(auth.uid(),p_market_id,'LOCAL_OFFER_DRAFT_CREATED','LOCAL_OFFER',v_offer,jsonb_build_object('business_id',p_business_id));
 v_result:=jsonb_build_object('offer_id',v_offer,'status','DRAFT','sponsorship_status','PENDING'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_create_local_offer_draft(uuid,uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated; grant execute on function private.admin_create_local_offer_draft(uuid,uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) to authenticated;
create or replace function public.admin_create_local_offer_draft(p_business_id uuid,p_market_id uuid,p_title text,p_body_text text,p_category_code text,p_cta_label text,p_cta_url text,p_origin_location_id uuid,p_destination_location_id uuid,p_locality_location_id uuid,p_valid_from timestamptz,p_valid_until timestamptz,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_create_local_offer_draft(p_business_id,p_market_id,p_title,p_body_text,p_category_code,p_cta_label,p_cta_url,p_origin_location_id,p_destination_location_id,p_locality_location_id,p_valid_from,p_valid_until,p_idempotency_key); $$;
revoke all on function public.admin_create_local_offer_draft(uuid,uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated; grant execute on function public.admin_create_local_offer_draft(uuid,uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function private.admin_update_local_offer_draft(p_offer_id uuid,p_title text,p_body_text text,p_category_code text,p_cta_label text,p_cta_url text,p_origin_location_id uuid,p_destination_location_id uuid,p_locality_location_id uuid,p_valid_from timestamptz,p_valid_until timestamptz,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb; v_hash text;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 if v_o.status not in ('DRAFT','REJECTED') then raise exception 'LOCAL_OFFER_NOT_EDITABLE'; end if;
 if p_valid_from is null or p_valid_until is null or p_valid_until<=p_valid_from or p_valid_until<=now() then raise exception 'OFFER_SCHEDULE_INVALID'; end if;
 if p_origin_location_id is not null and not exists(select 1 from public.locations where id=p_origin_location_id and is_active) then raise exception 'OFFER_CONTEXT_LOCATION_INVALID'; end if;
 if p_destination_location_id is not null and not exists(select 1 from public.locations where id=p_destination_location_id and is_active) then raise exception 'OFFER_CONTEXT_LOCATION_INVALID'; end if;
 if p_locality_location_id is not null and not exists(select 1 from public.locations where id=p_locality_location_id and is_active) then raise exception 'OFFER_CONTEXT_LOCATION_INVALID'; end if;
 v_hash:=md5(concat_ws('|',p_offer_id::text,trim(coalesce(p_title,'')),trim(coalesce(p_body_text,'')),upper(trim(coalesce(p_category_code,''))),coalesce(p_cta_label,''),coalesce(p_cta_url,''),coalesce(p_origin_location_id::text,''),coalesce(p_destination_location_id::text,''),coalesce(p_locality_location_id::text,''),p_valid_from::text,p_valid_until::text));
 v_idem:=private.claim_user_command('admin_update_local_offer_draft',p_idempotency_key,v_hash); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 update public.local_offers set title=trim(p_title),body_text=trim(p_body_text),category_code=upper(trim(p_category_code)),cta_label=nullif(trim(coalesce(p_cta_label,'')),''),cta_url=nullif(trim(coalesce(p_cta_url,'')),''),origin_location_id=p_origin_location_id,destination_location_id=p_destination_location_id,locality_location_id=p_locality_location_id,valid_from=p_valid_from,valid_until=p_valid_until,status='DRAFT',reviewed_at=null,reviewed_by=null,review_reason=null,updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id) values(p_offer_id,'OFFER_DRAFT_UPDATED',auth.uid());
 v_result:=jsonb_build_object('offer_id',p_offer_id,'status','DRAFT'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_update_local_offer_draft(uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated; grant execute on function private.admin_update_local_offer_draft(uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) to authenticated;
create or replace function public.admin_update_local_offer_draft(p_offer_id uuid,p_title text,p_body_text text,p_category_code text,p_cta_label text,p_cta_url text,p_origin_location_id uuid,p_destination_location_id uuid,p_locality_location_id uuid,p_valid_from timestamptz,p_valid_until timestamptz,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_update_local_offer_draft(p_offer_id,p_title,p_body_text,p_category_code,p_cta_label,p_cta_url,p_origin_location_id,p_destination_location_id,p_locality_location_id,p_valid_from,p_valid_until,p_idempotency_key); $$;
revoke all on function public.admin_update_local_offer_draft(uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) from public,anon,authenticated; grant execute on function public.admin_update_local_offer_draft(uuid,text,text,text,text,text,uuid,uuid,uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function private.admin_set_local_offer_sponsorship(p_offer_id uuid,p_sponsorship_status text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 if upper(p_sponsorship_status) not in ('PENDING','ACTIVE','PAUSED','ENDED') then raise exception 'SPONSORSHIP_STATUS_INVALID'; end if;
 if v_o.status='REMOVED' then raise exception 'LOCAL_OFFER_TRANSITION_INVALID'; end if;
 v_idem:=private.claim_user_command('admin_set_local_offer_sponsorship',p_idempotency_key,md5(p_offer_id::text||'|'||upper(p_sponsorship_status))); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 update public.local_offers set sponsorship_status=upper(p_sponsorship_status),updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id,details) values(p_offer_id,'SPONSORSHIP_STATUS_CHANGED',auth.uid(),jsonb_build_object('from',v_o.sponsorship_status,'to',upper(p_sponsorship_status)));
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id,metadata) values(auth.uid(),v_o.market_id,'LOCAL_OFFER_SPONSORSHIP_CHANGED','LOCAL_OFFER',p_offer_id,jsonb_build_object('from',v_o.sponsorship_status,'to',upper(p_sponsorship_status)));
 v_result:=jsonb_build_object('offer_id',p_offer_id,'sponsorship_status',upper(p_sponsorship_status)); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_set_local_offer_sponsorship(uuid,text,text) from public,anon,authenticated; grant execute on function private.admin_set_local_offer_sponsorship(uuid,text,text) to authenticated;
create or replace function public.admin_set_local_offer_sponsorship(p_offer_id uuid,p_sponsorship_status text,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_set_local_offer_sponsorship(p_offer_id,p_sponsorship_status,p_idempotency_key); $$;
revoke all on function public.admin_set_local_offer_sponsorship(uuid,text,text) from public,anon,authenticated; grant execute on function public.admin_set_local_offer_sponsorship(uuid,text,text) to authenticated;

create or replace function private.admin_submit_local_offer(p_offer_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 v_idem:=private.claim_user_command('admin_submit_local_offer',p_idempotency_key,md5(p_offer_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 if v_o.status not in ('DRAFT','REJECTED') then raise exception 'LOCAL_OFFER_TRANSITION_INVALID'; end if;
 update public.local_offers set status='SUBMITTED',submitted_at=now(),updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id) values(p_offer_id,'OFFER_SUBMITTED',auth.uid());
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id) values(auth.uid(),v_o.market_id,'LOCAL_OFFER_SUBMITTED','LOCAL_OFFER',p_offer_id);
 v_result:=jsonb_build_object('offer_id',p_offer_id,'status','SUBMITTED'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_submit_local_offer(uuid,text) from public,anon,authenticated; grant execute on function private.admin_submit_local_offer(uuid,text) to authenticated;
create or replace function public.admin_submit_local_offer(p_offer_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_submit_local_offer(p_offer_id,p_idempotency_key); $$;
revoke all on function public.admin_submit_local_offer(uuid,text) from public,anon,authenticated; grant execute on function public.admin_submit_local_offer(uuid,text) to authenticated;

create or replace function private.admin_begin_local_offer_review(p_offer_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 v_idem:=private.claim_user_command('admin_begin_local_offer_review',p_idempotency_key,md5(p_offer_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 if v_o.status<>'SUBMITTED' then raise exception 'LOCAL_OFFER_TRANSITION_INVALID'; end if;
 update public.local_offers set status='UNDER_REVIEW',updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id) values(p_offer_id,'OFFER_REVIEW_STARTED',auth.uid());
 v_result:=jsonb_build_object('offer_id',p_offer_id,'status','UNDER_REVIEW'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_begin_local_offer_review(uuid,text) from public,anon,authenticated; grant execute on function private.admin_begin_local_offer_review(uuid,text) to authenticated;
create or replace function public.admin_begin_local_offer_review(p_offer_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_begin_local_offer_review(p_offer_id,p_idempotency_key); $$;
revoke all on function public.admin_begin_local_offer_review(uuid,text) from public,anon,authenticated; grant execute on function public.admin_begin_local_offer_review(uuid,text) to authenticated;

create or replace function private.admin_review_local_offer(p_offer_id uuid,p_approve boolean,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb; v_status text;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 v_idem:=private.claim_user_command('admin_review_local_offer',p_idempotency_key,md5(p_offer_id::text||'|'||p_approve::text||'|'||coalesce(p_reason,''))); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 if v_o.status<>'UNDER_REVIEW' then raise exception 'LOCAL_OFFER_TRANSITION_INVALID'; end if;
 if not p_approve and char_length(trim(coalesce(p_reason,'')))<2 then raise exception 'OFFER_REJECTION_REASON_REQUIRED'; end if;
 v_status:=case when p_approve then 'APPROVED' else 'REJECTED' end;
 update public.local_offers set status=v_status,reviewed_at=now(),reviewed_by=auth.uid(),review_reason=nullif(trim(coalesce(p_reason,'')),''),updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id,details) values(p_offer_id,case when p_approve then 'OFFER_APPROVED' else 'OFFER_REJECTED' end,auth.uid(),jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')),'')));
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id,metadata) values(auth.uid(),v_o.market_id,case when p_approve then 'LOCAL_OFFER_APPROVED' else 'LOCAL_OFFER_REJECTED' end,'LOCAL_OFFER',p_offer_id,jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')),'')));
 v_result:=jsonb_build_object('offer_id',p_offer_id,'status',v_status); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_review_local_offer(uuid,boolean,text,text) from public,anon,authenticated; grant execute on function private.admin_review_local_offer(uuid,boolean,text,text) to authenticated;
create or replace function public.admin_review_local_offer(p_offer_id uuid,p_approve boolean,p_reason text,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_review_local_offer(p_offer_id,p_approve,p_reason,p_idempotency_key); $$;
revoke all on function public.admin_review_local_offer(uuid,boolean,text,text) from public,anon,authenticated; grant execute on function public.admin_review_local_offer(uuid,boolean,text,text) to authenticated;

create or replace function private.admin_pause_local_offer(p_offer_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 v_idem:=private.claim_user_command('admin_pause_local_offer',p_idempotency_key,md5(p_offer_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 if v_o.status not in ('APPROVED','SCHEDULED','ACTIVE') then raise exception 'LOCAL_OFFER_TRANSITION_INVALID'; end if;
 update public.local_offers set status='PAUSED',paused_at=now(),updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id) values(p_offer_id,'OFFER_PAUSED',auth.uid());
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id) values(auth.uid(),v_o.market_id,'LOCAL_OFFER_PAUSED','LOCAL_OFFER',p_offer_id);
 v_result:=jsonb_build_object('offer_id',p_offer_id,'status','PAUSED'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_pause_local_offer(uuid,text) from public,anon,authenticated; grant execute on function private.admin_pause_local_offer(uuid,text) to authenticated;
create or replace function public.admin_pause_local_offer(p_offer_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_pause_local_offer(p_offer_id,p_idempotency_key); $$;
revoke all on function public.admin_pause_local_offer(uuid,text) from public,anon,authenticated; grant execute on function public.admin_pause_local_offer(uuid,text) to authenticated;

create or replace function private.admin_resume_local_offer(p_offer_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 v_idem:=private.claim_user_command('admin_resume_local_offer',p_idempotency_key,md5(p_offer_id::text)); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 if v_o.status<>'PAUSED' then raise exception 'LOCAL_OFFER_TRANSITION_INVALID'; end if;
 update public.local_offers set status='APPROVED',paused_at=null,updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id) values(p_offer_id,'OFFER_RESUMED',auth.uid());
 v_result:=jsonb_build_object('offer_id',p_offer_id,'status','APPROVED'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_resume_local_offer(uuid,text) from public,anon,authenticated; grant execute on function private.admin_resume_local_offer(uuid,text) to authenticated;
create or replace function public.admin_resume_local_offer(p_offer_id uuid,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_resume_local_offer(p_offer_id,p_idempotency_key); $$;
revoke all on function public.admin_resume_local_offer(uuid,text) from public,anon,authenticated; grant execute on function public.admin_resume_local_offer(uuid,text) to authenticated;

create or replace function private.admin_remove_local_offer(p_offer_id uuid,p_reason text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_o public.local_offers%rowtype; v_idem public.command_idempotency; v_result jsonb;
begin
 select * into v_o from public.local_offers where id=p_offer_id for update; if not found then raise exception 'LOCAL_OFFER_NOT_FOUND'; end if; perform private.require_local_commerce(v_o.market_id);
 v_idem:=private.claim_user_command('admin_remove_local_offer',p_idempotency_key,md5(p_offer_id::text||'|'||coalesce(p_reason,''))); if v_idem.status='SUCCEEDED' then return v_idem.result; end if;
 if v_o.status='REMOVED' then v_result:=jsonb_build_object('offer_id',p_offer_id,'status','REMOVED'); return private.complete_user_command(v_idem.id,v_result); end if;
 update public.local_offers set status='REMOVED',removed_at=now(),review_reason=coalesce(nullif(trim(coalesce(p_reason,'')),''),review_reason),updated_by=auth.uid() where id=p_offer_id;
 insert into public.local_offer_events(offer_id,event_type,actor_profile_id,details) values(p_offer_id,'OFFER_REMOVED',auth.uid(),jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')),'')));
 insert into public.audit_events(actor_profile_id,market_id,action,entity_type,entity_id,metadata) values(auth.uid(),v_o.market_id,'LOCAL_OFFER_REMOVED','LOCAL_OFFER',p_offer_id,jsonb_build_object('reason',nullif(trim(coalesce(p_reason,'')),'')));
 v_result:=jsonb_build_object('offer_id',p_offer_id,'status','REMOVED'); return private.complete_user_command(v_idem.id,v_result);
end; $$;
revoke all on function private.admin_remove_local_offer(uuid,text,text) from public,anon,authenticated; grant execute on function private.admin_remove_local_offer(uuid,text,text) to authenticated;
create or replace function public.admin_remove_local_offer(p_offer_id uuid,p_reason text,p_idempotency_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.admin_remove_local_offer(p_offer_id,p_reason,p_idempotency_key); $$;
revoke all on function public.admin_remove_local_offer(uuid,text,text) from public,anon,authenticated; grant execute on function public.admin_remove_local_offer(uuid,text,text) to authenticated;