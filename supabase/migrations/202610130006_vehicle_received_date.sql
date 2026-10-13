begin;

alter table public.vehicles
  add column if not exists received_date date
  check (
    received_date is null
    or isfinite(received_date)
  );

-- Use the most recently created arrival's date
-- as the initial received date for each vehicle.
update public.vehicles v
set received_date = (
  select a.received_date
  from public.vehicle_arrivals a
  where a.vehicle_id = v.id
  order by a.created_at desc, a.id desc
  limit 1
)
where v.received_date is null;

commit;