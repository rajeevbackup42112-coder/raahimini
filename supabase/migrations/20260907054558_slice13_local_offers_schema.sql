create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 2 and 120),
  category_code text not null check (category_code ~ '^[A-Z0-9_]{2,40}$'),
  description text check (description is null or char_length(description) <= 600),
  address_text text check (address_text is null or char_length(address_text) <= 300),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  website_url text check (website_url is null or website_url ~ '^https?://'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','REMOVED')),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_businesses_created_by on public.businesses(created_by);
create index idx_businesses_updated_by on public.businesses(updated_by);
create trigger businesses_set_updated_at before update on public.businesses for each row execute function private.set_updated_at();

create table public.business_market_scopes (
  business_id uuid not null references public.businesses(id) on delete cascade,
  market_id uuid not null references public.markets(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (business_id,market_id)
);
create index idx_business_market_scopes_market on public.business_market_scopes(market_id,status,business_id);
create index idx_business_market_scopes_created_by on public.business_market_scopes(created_by);

create table public.local_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  market_id uuid not null references public.markets(id),
  title text not null check (char_length(trim(title)) between 2 and 140),
  body_text text not null check (char_length(trim(body_text)) between 2 and 700),
  category_code text not null check (category_code ~ '^[A-Z0-9_]{2,40}$'),
  cta_label text check (cta_label is null or char_length(trim(cta_label)) between 1 and 60),
  cta_url text check (cta_url is null or cta_url ~ '^https?://'),
  origin_location_id uuid references public.locations(id),
  destination_location_id uuid references public.locations(id),
  locality_location_id uuid references public.locations(id),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  sponsorship_status text not null default 'PENDING' check (sponsorship_status in ('PENDING','ACTIVE','PAUSED','ENDED')),
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','SCHEDULED','ACTIVE','EXPIRED','REJECTED','PAUSED','SUSPENDED','REMOVED')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_reason text check (review_reason is null or char_length(review_reason) <= 500),
  paused_at timestamptz,
  removed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until > valid_from)
);
create index idx_local_offers_business on public.local_offers(business_id,created_at desc);
create index idx_local_offers_market_status_schedule on public.local_offers(market_id,status,valid_from,valid_until);
create index idx_local_offers_origin on public.local_offers(origin_location_id) where origin_location_id is not null;
create index idx_local_offers_destination on public.local_offers(destination_location_id) where destination_location_id is not null;
create index idx_local_offers_locality on public.local_offers(locality_location_id) where locality_location_id is not null;
create index idx_local_offers_reviewed_by on public.local_offers(reviewed_by) where reviewed_by is not null;
create index idx_local_offers_created_by on public.local_offers(created_by);
create index idx_local_offers_updated_by on public.local_offers(updated_by);
create trigger local_offers_set_updated_at before update on public.local_offers for each row execute function private.set_updated_at();

create table public.local_offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.local_offers(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 2 and 80),
  actor_profile_id uuid references public.profiles(id),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index idx_local_offer_events_offer on public.local_offer_events(offer_id,occurred_at desc);
create index idx_local_offer_events_actor on public.local_offer_events(actor_profile_id) where actor_profile_id is not null;

create table public.local_offer_daily_metrics (
  offer_id uuid not null references public.local_offers(id) on delete cascade,
  metric_date date not null,
  market_id uuid not null references public.markets(id),
  surface text not null check (surface ~ '^[A-Z0-9_]{2,40}$'),
  impressions integer not null default 0 check (impressions >= 0),
  engagements integer not null default 0 check (engagements >= 0),
  updated_at timestamptz not null default now(),
  primary key (offer_id,metric_date,surface)
);
create index idx_local_offer_daily_metrics_market on public.local_offer_daily_metrics(market_id,metric_date desc);

alter table public.businesses enable row level security;
alter table public.business_market_scopes enable row level security;
alter table public.local_offers enable row level security;
alter table public.local_offer_events enable row level security;
alter table public.local_offer_daily_metrics enable row level security;

create policy businesses_no_direct_client_access on public.businesses for all to anon,authenticated using(false) with check(false);
create policy business_market_scopes_no_direct_client_access on public.business_market_scopes for all to anon,authenticated using(false) with check(false);
create policy local_offers_no_direct_client_access on public.local_offers for all to anon,authenticated using(false) with check(false);
create policy local_offer_events_no_direct_client_access on public.local_offer_events for all to anon,authenticated using(false) with check(false);
create policy local_offer_daily_metrics_no_direct_client_access on public.local_offer_daily_metrics for all to anon,authenticated using(false) with check(false);

revoke all on table public.businesses from anon,authenticated;
revoke all on table public.business_market_scopes from anon,authenticated;
revoke all on table public.local_offers from anon,authenticated;
revoke all on table public.local_offer_events from anon,authenticated;
revoke all on table public.local_offer_daily_metrics from anon,authenticated;