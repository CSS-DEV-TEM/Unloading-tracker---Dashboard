begin;

-- Each arrival is a separate record.
-- The same vehicle can arrive multiple times, even on the same day.
create table public.vehicle_arrivals (
  id uuid primary key default gen_random_uuid(),

  vehicle_id uuid not null
    references public.vehicles(id)
    on delete restrict,

  received_date date not null,

  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vehicle_arrivals_valid_date
    check (isfinite(received_date)),

  constraint vehicle_arrivals_valid_version
    check (version > 0),

  constraint vehicle_arrivals_id_vehicle_unique
    unique (id, vehicle_id)
);

create index vehicle_arrivals_vehicle_date_idx
  on public.vehicle_arrivals (
    vehicle_id,
    received_date desc,
    id
  );

-- Existing invoices stay unchanged, with no arrival selected.
alter table public.invoices
  add column vehicle_arrival_id uuid;

-- An arrival must belong to the invoice's assigned vehicle.
alter table public.invoices
  add constraint invoices_arrival_requires_vehicle
  check (
    vehicle_arrival_id is null
    or vehicle_id is not null
  );

alter table public.invoices
  add constraint invoices_vehicle_arrival_fk
  foreign key (vehicle_arrival_id, vehicle_id)
  references public.vehicle_arrivals (id, vehicle_id)
  on delete restrict;

create index invoices_vehicle_arrival_idx
  on public.invoices (vehicle_arrival_id)
  where vehicle_arrival_id is not null;

-- Active dashboard users can read arrival records.
-- Writes will go through validated database functions.
alter table public.vehicle_arrivals
  enable row level security;

revoke all on table public.vehicle_arrivals
  from public, anon, authenticated;

grant select on table public.vehicle_arrivals
  to authenticated;

create policy vehicle_arrivals_active_read
  on public.vehicle_arrivals
  for select
  to authenticated
  using (
    (select private.current_active_role())
      in ('ADMIN', 'USER')
  );

commit;