-- Local Offers: transparent Admin-managed sponsorship. No transport-state mutation or behavioral tracking.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('promotion-assets','promotion-assets',true,5242880,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.local_promotions(
  id uuid primary key default gen_random_uuid(),
  business_name text not null check(char_length(business_name) between 2 and 100),
  headline text not null check(char_length(headline) between 2 and 120),
  description text not null check(char_length(description) between 2 and 300),
  locality text check(locality is null or char_length(locality)<=120),
  contact_phone text check(contact_phone is null or char_length(contact_phone)<=30),
  whatsapp_phone text check(whatsapp_phone is null or char_length(whatsapp_phone)<=30),
  image_path text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  amount_collected integer not null default 0 check(amount_collected>=0),
  status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','ARCHIVED')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);
create index if not exists idx_local_promotions_active on public.local_promotions(starts_at,ends_at) where status='ACTIVE';
alter table public.local_promotions enable row level security;
revoke all on table public.local_promotions from public,anon,authenticated,service_role;
drop trigger if exists set_local_promotions_updated_at on public.local_promotions;
create trigger set_local_promotions_updated_at before update on public.local_promotions for each row execute function public.set_updated_at();

drop policy if exists "Raahi Admin promotion upload" on storage.objects;
create policy "Raahi Admin promotion upload" on storage.objects for insert to authenticated
with check(bucket_id='promotion-assets' and public.is_admin());
drop policy if exists "Raahi Admin promotion update" on storage.objects;
create policy "Raahi Admin promotion update" on storage.objects for update to authenticated
using(bucket_id='promotion-assets' and public.is_admin()) with check(bucket_id='promotion-assets' and public.is_admin());
drop policy if exists "Raahi Admin promotion delete" on storage.objects;
create policy "Raahi Admin promotion delete" on storage.objects for delete to authenticated
using(bucket_id='promotion-assets' and public.is_admin());

create or replace function public.get_active_local_promotions(p_limit integer default 10)
returns table(promotion_id uuid,business_name text,headline text,description text,locality text,contact_phone text,whatsapp_phone text,image_path text,starts_at timestamptz,ends_at timestamptz)
language sql stable security definer set search_path to 'public'
as $function$
  select p.id,p.business_name,p.headline,p.description,p.locality,p.contact_phone,p.whatsapp_phone,p.image_path,p.starts_at,p.ends_at
  from public.local_promotions p
  where p.status='ACTIVE' and p.starts_at<=now() and p.ends_at>now()
  order by p.created_at desc
  limit greatest(1,least(coalesce(p_limit,10),20));
$function$;

create or replace function public.admin_list_local_promotions()
returns table(promotion_id uuid,business_name text,headline text,description text,locality text,contact_phone text,whatsapp_phone text,image_path text,starts_at timestamptz,ends_at timestamptz,amount_collected integer,status text,created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_admin() then return; end if;
  return query select p.id,p.business_name,p.headline,p.description,p.locality,p.contact_phone,p.whatsapp_phone,p.image_path,p.starts_at,p.ends_at,p.amount_collected,p.status,p.created_at
  from public.local_promotions p order by case when p.status='ACTIVE' and p.ends_at>now() then 0 when p.status='DRAFT' then 1 else 2 end,p.created_at desc;
end;
$function$;

create or replace function public.admin_save_local_promotion(
  p_promotion_id uuid,p_business_name text,p_headline text,p_description text,p_locality text,p_contact_phone text,p_whatsapp_phone text,p_image_path text,
  p_starts_at timestamptz,p_ends_at timestamptz,p_amount_collected integer default 0
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid:=p_promotion_id;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if char_length(trim(coalesce(p_business_name,'')))<2 or char_length(p_business_name)>100 then return jsonb_build_object('success',false,'error','Enter a business name'); end if;
  if char_length(trim(coalesce(p_headline,'')))<2 or char_length(p_headline)>120 then return jsonb_build_object('success',false,'error','Enter an offer headline'); end if;
  if char_length(trim(coalesce(p_description,'')))<2 or char_length(p_description)>300 then return jsonb_build_object('success',false,'error','Enter a short description'); end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then return jsonb_build_object('success',false,'error','Choose a valid promotion window'); end if;
  if coalesce(p_amount_collected,0)<0 then return jsonb_build_object('success',false,'error','Amount collected cannot be negative'); end if;
  if v_id is null then
    insert into public.local_promotions(business_name,headline,description,locality,contact_phone,whatsapp_phone,image_path,starts_at,ends_at,amount_collected,created_by)
    values(trim(p_business_name),trim(p_headline),trim(p_description),nullif(trim(coalesce(p_locality,'')),''),nullif(trim(coalesce(p_contact_phone,'')),''),nullif(trim(coalesce(p_whatsapp_phone,'')),''),nullif(trim(coalesce(p_image_path,'')),''),p_starts_at,p_ends_at,coalesce(p_amount_collected,0),auth.uid()) returning id into v_id;
  else
    if not exists(select 1 from public.local_promotions where id=v_id) then return jsonb_build_object('success',false,'error','Promotion not found'); end if;
    update public.local_promotions set business_name=trim(p_business_name),headline=trim(p_headline),description=trim(p_description),locality=nullif(trim(coalesce(p_locality,'')),''),contact_phone=nullif(trim(coalesce(p_contact_phone,'')),''),whatsapp_phone=nullif(trim(coalesce(p_whatsapp_phone,'')),''),image_path=nullif(trim(coalesce(p_image_path,'')),''),starts_at=p_starts_at,ends_at=p_ends_at,amount_collected=coalesce(p_amount_collected,0) where id=v_id;
  end if;
  perform public.record_audit('admin_save_local_promotion','local_promotions',v_id,null,jsonb_build_object('business_name',trim(p_business_name),'amount_collected',coalesce(p_amount_collected,0)),null);
  return jsonb_build_object('success',true,'promotion_id',v_id);
end;
$function$;

create or replace function public.admin_set_local_promotion_status(p_promotion_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_status text:=upper(trim(coalesce(p_status,''))); v_row public.local_promotions;
begin
  if not public.is_admin() then return jsonb_build_object('success',false,'error','Admin access required'); end if;
  if v_status not in ('DRAFT','ACTIVE','ARCHIVED') then return jsonb_build_object('success',false,'error','Invalid promotion status'); end if;
  select * into v_row from public.local_promotions where id=p_promotion_id for update;
  if v_row.id is null then return jsonb_build_object('success',false,'error','Promotion not found'); end if;
  if v_status='ACTIVE' and v_row.ends_at<=now() then return jsonb_build_object('success',false,'error','Extend the end date before activating this promotion'); end if;
  update public.local_promotions set status=v_status where id=v_row.id;
  perform public.record_audit('admin_set_local_promotion_status','local_promotions',v_row.id,to_jsonb(v_row),jsonb_build_object('status',v_status),null);
  return jsonb_build_object('success',true,'status',v_status);
end;
$function$;

revoke all on function public.get_active_local_promotions(integer) from public,service_role;
revoke all on function public.admin_list_local_promotions() from public,anon,service_role;
revoke all on function public.admin_save_local_promotion(uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,integer) from public,anon,service_role;
revoke all on function public.admin_set_local_promotion_status(uuid,text) from public,anon,service_role;
grant execute on function public.get_active_local_promotions(integer) to anon,authenticated;
grant execute on function public.admin_list_local_promotions() to authenticated;
grant execute on function public.admin_save_local_promotion(uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,integer) to authenticated;
grant execute on function public.admin_set_local_promotion_status(uuid,text) to authenticated;
