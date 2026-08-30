-- Outstation marketplace core. Separate from fixed-route FIFO/trips/seats/GPS.
create table if not exists public.outstation_requests (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  origin_location_id uuid not null references public.locations(id),
  destination_text text not null check (char_length(destination_text) between 2 and 160),
  travel_type text not null check (travel_type in ('ONE_WAY','ROUND_TRIP')),
  departure_at timestamptz not null,
  return_at timestamptz,
  passenger_count integer not null check (passenger_count between 1 and 8),
  notes text check (notes is null or char_length(notes)<=500),
  status text not null default 'OPEN' check (status in ('OPEN','ACCEPTED','CANCELLED','EXPIRED')),
  accepted_quote_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  accepted_at timestamptz
);

create table if not exists public.outstation_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.outstation_requests(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  total_price integer not null check (total_price between 1 and 1000000),
  includes_tolls boolean not null default false,
  includes_parking boolean not null default false,
  driver_note text check (driver_note is null or char_length(driver_note)<=300),
  vehicle_number text not null,
  vehicle_type text,
  vehicle_model text,
  vehicle_capacity integer not null,
  status text not null default 'OFFERED' check (status in ('OFFERED','ACCEPTED','CLOSED','WITHDRAWN','EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,driver_id)
);

create table if not exists public.outstation_driver_ignores (
  request_id uuid not null references public.outstation_requests(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(request_id,driver_id)
);

alter table public.outstation_requests
  add constraint outstation_requests_accepted_quote_fk
  foreign key (accepted_quote_id) references public.outstation_quotes(id) deferrable initially deferred;

create index if not exists idx_outstation_requests_open_origin on public.outstation_requests(origin_location_id,departure_at) where status='OPEN';
create index if not exists idx_outstation_requests_passenger on public.outstation_requests(passenger_id,created_at desc);
create index if not exists idx_outstation_quotes_request on public.outstation_quotes(request_id,status,total_price);
create index if not exists idx_outstation_quotes_driver on public.outstation_quotes(driver_id,created_at desc);

alter table public.outstation_requests enable row level security;
alter table public.outstation_quotes enable row level security;
alter table public.outstation_driver_ignores enable row level security;
revoke all on table public.outstation_requests from public,anon,authenticated,service_role;
revoke all on table public.outstation_quotes from public,anon,authenticated,service_role;
revoke all on table public.outstation_driver_ignores from public,anon,authenticated,service_role;

drop trigger if exists set_outstation_requests_updated_at on public.outstation_requests;
create trigger set_outstation_requests_updated_at before update on public.outstation_requests
for each row execute function public.set_updated_at();
drop trigger if exists set_outstation_quotes_updated_at on public.outstation_quotes;
create trigger set_outstation_quotes_updated_at before update on public.outstation_quotes
for each row execute function public.set_updated_at();
