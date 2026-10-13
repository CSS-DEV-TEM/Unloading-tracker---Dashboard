begin;

create or replace function public.add_vehicle_with_received_date(
  p_number text,
  p_received_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_vehicle_id uuid;
begin
  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and is_active
    and role in ('ADMIN', 'USER')
  for share;

  if not found then
    raise exception 'Active dashboard access required.'
      using errcode = '42501';
  end if;

  if p_received_date is not null
     and not isfinite(p_received_date) then
    raise exception 'Select a valid received date.'
      using errcode = '22023';
  end if;

  v_vehicle_id := public.add_vehicle(p_number);

  select *
  into v_vehicle
  from public.vehicles
  where id = v_vehicle_id
  for update;

  if not found then
    raise exception 'Vehicle not found.'
      using errcode = 'P0002';
  end if;

  if v_vehicle.is_archived then
    raise exception 'Restore the archived vehicle first.'
      using errcode = 'PVA01';
  end if;

  -- A blank date preserves the current received date.
  if p_received_date is null
     or p_received_date is not distinct from v_vehicle.received_date then
    return v_vehicle_id;
  end if;

  perform i.id
  from public.invoices i
  where i.vehicle_id = v_vehicle_id
  order by i.id
  for update;

  if exists (
    select 1
    from public.invoices i
    where i.vehicle_id = v_vehicle_id
      and (
        i.status = 'Complete'
        or exists (
          select 1
          from public.asn_updates a
          where a.invoice_id = i.id
            and a.is_shared
        )
      )
  ) then
    raise exception
      'Reopen linked invoices before changing the received date.'
      using errcode = 'PVC01';
  end if;

  update public.vehicles
  set received_date = p_received_date,
      version = version + 1,
      updated_at = now()
  where id = v_vehicle_id;

  insert into public.activity_logs (
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    changes
  )
  values (
    v_actor.id,
    v_actor.full_name,
    'VEHICLE_RECEIVED_DATE_UPDATED',
    'vehicle',
    v_vehicle_id,
    jsonb_build_object(
      'received_date',
      jsonb_build_object(
        'old', v_vehicle.received_date,
        'new', p_received_date
      )
    )
  );

  return v_vehicle_id;
end;
$$;

revoke all
on function public.add_vehicle_with_received_date(text, date)
from public, anon, authenticated;

grant execute
on function public.add_vehicle_with_received_date(text, date)
to authenticated;

commit;