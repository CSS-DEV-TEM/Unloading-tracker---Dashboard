begin;

create or replace function public.update_vehicle_details(
  p_vehicle_id uuid,
  p_expected_version integer,
  p_number text,
  p_received_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
begin
  if p_received_date is not null
     and not isfinite(p_received_date) then
    raise exception 'Select a valid received date.'
      using errcode = '22023';
  end if;

  -- Existing function checks administrator access,
  -- vehicle number and concurrent changes.
  -- Both updates run in the same transaction.
  perform public.rename_vehicle(
    p_vehicle_id,
    p_expected_version,
    p_number
  );

  select *
  into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if v_vehicle.received_date is not distinct from
     p_received_date then
    return p_vehicle_id;
  end if;

  -- Preserve the existing completed/ASN-shared protection.
  perform i.id
  from public.invoices i
  where i.vehicle_id = p_vehicle_id
  order by i.id
  for update;

  if exists (
    select 1
    from public.invoices i
    where i.vehicle_id = p_vehicle_id
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
      'Reopen linked completed or ASN shared invoices before changing the received date.'
      using errcode = 'PVC01';
  end if;

  update public.vehicles
  set received_date = p_received_date,
      version = version + 1,
      updated_at = now()
  where id = p_vehicle_id;

  insert into public.activity_logs (
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    changes
  )
  select
    p.id,
    p.full_name,
    'VEHICLE_RECEIVED_DATE_UPDATED',
    'vehicle',
    p_vehicle_id,
    jsonb_build_object(
      'received_date',
      jsonb_build_object(
        'old', v_vehicle.received_date,
        'new', p_received_date
      )
    )
  from public.profiles p
  where p.id = auth.uid();

  return p_vehicle_id;
end;
$$;

revoke all on function public.update_vehicle_details(
  uuid, integer, text, date
) from public, anon, authenticated;

grant execute on function public.update_vehicle_details(
  uuid, integer, text, date
) to authenticated;

commit;