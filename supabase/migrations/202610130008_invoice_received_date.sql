begin;

create or replace function public.save_invoice_with_received_date(
  p_invoice_id uuid,
  p_expected_version integer,
  p_invoice_number text,
  p_supplier text,
  p_roll_quantity integer,
  p_system_type text,
  p_document_share_date date,
  p_shipment_type text,
  p_vehicle_number text,
  p_received_date date,
  p_expected_received_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_invoice_id uuid;
  v_vehicle_id uuid;
  v_original_vehicle_id uuid;
begin
  -- Use the same active roles as invoice creation/editing.
  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and is_active
    and role in ('ADMIN', 'USER')
  for share;

  if not found then
    raise exception 'Active dashboard access is required.'
      using errcode = '42501';
  end if;

  if p_received_date is not null then
    if not isfinite(p_received_date) then
      raise exception 'Select a valid received date.'
        using errcode = '22023';
    end if;

    if nullif(btrim(p_vehicle_number), '') is null then
      raise exception 'Enter a vehicle number for the received date.'
        using errcode = '22023';
    end if;
  end if;

  if p_invoice_id is null then
    -- New invoice: reuse existing validation and audit logic.
    v_invoice_id := public.create_invoice_v2(
      p_invoice_number,
      p_supplier,
      p_roll_quantity,
      p_system_type,
      p_document_share_date,
      p_shipment_type,
      p_vehicle_number
    );
  else
    select vehicle_id
    into v_original_vehicle_id
    from public.invoices
    where id = p_invoice_id;

    -- Existing invoice: preserve version and assignment checks.
    perform public.update_invoice_details_v2(
      p_invoice_id,
      p_expected_version,
      p_invoice_number,
      p_supplier,
      p_roll_quantity,
      p_document_share_date,
      p_shipment_type,
      p_vehicle_number
    );

    v_invoice_id := p_invoice_id;
  end if;

  -- Blank date means leave the current vehicle date unchanged.
  if p_received_date is null then
    return v_invoice_id;
  end if;

  select vehicle_id
  into v_vehicle_id
  from public.invoices
  where id = v_invoice_id;

  if v_vehicle_id is null then
    raise exception 'A vehicle is required for the received date.'
      using errcode = '22023';
  end if;

  select *
  into v_vehicle
  from public.vehicles
  where id = v_vehicle_id
  for update;

  if not found then
    raise exception 'Vehicle not found.'
      using errcode = 'P0002';
  end if;

  if v_vehicle.received_date is not distinct from p_received_date then
    return v_invoice_id;
  end if;

  -- Prevent an older edit form from overwriting a newer date.
  if p_invoice_id is not null
     and v_original_vehicle_id = v_vehicle_id
     and v_vehicle.received_date is distinct from
         p_expected_received_date then
    raise exception 'Vehicle received date changed. Reload and try again.'
      using errcode = '40001';
  end if;

  if v_vehicle.is_archived then
    raise exception 'Restore this vehicle before changing its date.'
      using errcode = 'PVA01';
  end if;

  -- Preserve the existing completed/ASN-shared protection.
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
      'Reopen linked completed or ASN shared invoices before changing the received date.'
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

  return v_invoice_id;
end;
$$;

revoke all on function public.save_invoice_with_received_date(
  uuid, integer, text, text, integer, text,
  date, text, text, date, date
) from public, anon, authenticated;

grant execute on function public.save_invoice_with_received_date(
  uuid, integer, text, text, integer, text,
  date, text, text, date, date
) to authenticated;

commit;