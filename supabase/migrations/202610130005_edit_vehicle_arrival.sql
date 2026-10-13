begin;

create or replace function public.update_vehicle_arrival_date(
  p_arrival_id uuid,
  p_expected_version integer,
  p_received_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_arrival public.vehicle_arrivals%rowtype;
  v_version integer;
begin
  select * into v_actor
  from public.profiles
  where id = auth.uid()
    and is_active
    and role = 'ADMIN'
  for share;

  if not found then
    raise exception 'Administrator access is required.'
      using errcode = '42501';
  end if;

  if p_received_date is null
     or not isfinite(p_received_date) then
    raise exception 'Select a valid received date.'
      using errcode = '22023';
  end if;

  select * into v_arrival
  from public.vehicle_arrivals
  where id = p_arrival_id
  for update;

  if not found then
    raise exception 'Arrival not found.'
      using errcode = 'P0002';
  end if;

  if p_expected_version is distinct from v_arrival.version then
    raise exception 'Arrival changed. Reload before saving.'
      using errcode = '40001';
  end if;

  if p_received_date = v_arrival.received_date then
    return v_arrival.version;
  end if;

  -- Lock linked invoices before checking their current status.
  perform i.id
  from public.invoices i
  where i.vehicle_arrival_id = p_arrival_id
  order by i.id
  for update;

  if exists (
    select 1
    from public.invoices i
    where i.vehicle_arrival_id = p_arrival_id
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
    raise exception 'Reopen linked completed invoices before changing this date.'
      using errcode = 'PVC01';
  end if;

  update public.vehicle_arrivals
  set received_date = p_received_date,
      version = version + 1,
      updated_at = now()
  where id = p_arrival_id
  returning version into v_version;

  -- Existing invoice editors must reload the changed arrival details.
  update public.invoices
  set version = version + 1,
      updated_at = now(),
      updated_by = v_actor.id
  where vehicle_arrival_id = p_arrival_id;

  insert into public.activity_logs (
    actor_id, actor_name, action,
    entity_type, entity_id, changes
  )
  values (
    v_actor.id,
    v_actor.full_name,
    'VEHICLE_ARRIVAL_DATE_UPDATED',
    'vehicle_arrival',
    p_arrival_id,
    jsonb_build_object(
      'vehicle_id',
      jsonb_build_object(
        'old', v_arrival.vehicle_id,
        'new', v_arrival.vehicle_id
      ),
      'received_date',
      jsonb_build_object(
        'old', v_arrival.received_date,
        'new', p_received_date
      )
    )
  );

  return v_version;
end;
$$;

revoke all on function public.update_vehicle_arrival_date(
  uuid, integer, date
) from public, anon, authenticated;

grant execute on function public.update_vehicle_arrival_date(
  uuid, integer, date
) to authenticated;

commit;