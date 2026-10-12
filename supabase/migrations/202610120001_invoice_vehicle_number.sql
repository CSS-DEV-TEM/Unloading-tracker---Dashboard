begin;

alter table public.invoices
  add column if not exists vehicle_number text;

alter table public.invoices
  add constraint invoices_vehicle_number_length
  check (
    vehicle_number is null
    or char_length(btrim(vehicle_number)) between 1 and 30
  );

create or replace function public.create_invoice_v2(
  p_invoice_number text,
  p_supplier text,
  p_roll_quantity integer,
  p_system_type text,
  p_document_share_date date,
  p_shipment_type text,
  p_vehicle_number text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_invoice public.invoices%rowtype;
  v_vehicle text := nullif(btrim(p_vehicle_number), '');
begin
  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and is_active = true
    and role in ('ADMIN', 'USER')
  for share;

  if not found then
    raise exception 'Active dashboard access is required.'
      using errcode = '42501';
  end if;

  if p_invoice_number is null
     or char_length(btrim(p_invoice_number)) not between 1 and 100 then
    raise exception 'Invalid invoice number.'
      using errcode = '22023';
  end if;

  if p_supplier is null
     or char_length(btrim(p_supplier)) not between 1 and 250 then
    raise exception 'Invalid supplier.'
      using errcode = '22023';
  end if;

  if char_length(v_vehicle) > 30 then
    raise exception 'Vehicle number must be 30 characters or fewer.'
      using errcode = '22023';
  end if;

  if p_roll_quantity is not null and p_roll_quantity < 0 then
    raise exception 'Invalid roll quantity.'
      using errcode = '22023';
  end if;

  if p_system_type is null
     or p_system_type not in ('AX', 'D365', 'AX/D365') then
    raise exception 'Invalid system.'
      using errcode = '22023';
  end if;

  if p_shipment_type is null
     or p_shipment_type not in ('LOCAL', 'IMPORT') then
    raise exception 'Invalid shipment type.'
      using errcode = '22023';
  end if;

  if p_document_share_date is null
     or not isfinite(p_document_share_date) then
    raise exception 'Invalid document share date.'
      using errcode = '22023';
  end if;

  insert into public.invoices (
    invoice_number,
    supplier,
    roll_quantity,
    vehicle_number,
    system_type,
    document_share_date,
    shipment_type,
    created_by,
    updated_by
  )
  values (
    btrim(p_invoice_number),
    btrim(p_supplier),
    p_roll_quantity,
    v_vehicle,
    p_system_type,
    p_document_share_date,
    p_shipment_type,
    v_actor.id,
    v_actor.id
  )
  returning * into v_invoice;

  if p_system_type in ('AX', 'AX/D365') then
    insert into public.pre_grn_stages (invoice_id, system_name)
    values (v_invoice.id, 'AX');
  end if;

  if p_system_type in ('D365', 'AX/D365') then
    insert into public.pre_grn_stages (invoice_id, system_name)
    values (v_invoice.id, 'D365');
  end if;

  insert into public.asn_updates (invoice_id)
  values (v_invoice.id);

  insert into public.activity_logs (
    invoice_id, actor_id, actor_name,
    action, entity_type, entity_id, changes
  )
  values (
    v_invoice.id,
    v_actor.id,
    v_actor.full_name,
    'INVOICE_CREATED',
    'invoice',
    v_invoice.id,
    jsonb_build_object(
      'invoice',
      jsonb_build_object(
        'old', null,
        'new', to_jsonb(v_invoice)
      )
    )
  );

  return v_invoice.id;
end;
$$;

create or replace function public.update_invoice_details_v2(
  p_invoice_id uuid,
  p_expected_version integer,
  p_invoice_number text,
  p_supplier text,
  p_roll_quantity integer,
  p_document_share_date date,
  p_shipment_type text,
  p_vehicle_number text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_invoice public.invoices%rowtype;
  v_number text := btrim(p_invoice_number);
  v_supplier text := btrim(p_supplier);
  v_vehicle text := nullif(btrim(p_vehicle_number), '');
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb;
  v_version integer;
begin
  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and is_active = true
    and role in ('ADMIN', 'USER')
  for share;

  if not found then
    raise exception 'Active dashboard access is required.'
      using errcode = '42501';
  end if;

  if v_number is null
     or char_length(v_number) not between 1 and 100 then
    raise exception 'Invalid invoice number.'
      using errcode = '22023';
  end if;

  if v_supplier is null
     or char_length(v_supplier) not between 1 and 250 then
    raise exception 'Invalid supplier.'
      using errcode = '22023';
  end if;

  if char_length(v_vehicle) > 30 then
    raise exception 'Vehicle number must be 30 characters or fewer.'
      using errcode = '22023';
  end if;

  if p_roll_quantity is not null and p_roll_quantity < 0 then
    raise exception 'Invalid roll quantity.'
      using errcode = '22023';
  end if;

  if p_document_share_date is null
     or not isfinite(p_document_share_date) then
    raise exception 'Invalid document share date.'
      using errcode = '22023';
  end if;

  if p_shipment_type is null
     or p_shipment_type not in ('LOCAL', 'IMPORT') then
    raise exception 'Invalid shipment type.'
      using errcode = '22023';
  end if;

  select *
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.'
      using errcode = 'P0002';
  end if;

  if p_expected_version is distinct from v_invoice.version then
    raise exception 'Invoice has been updated by another user.'
      using errcode = '40001';
  end if;

  v_before := jsonb_build_object(
    'invoice_number', v_invoice.invoice_number,
    'supplier', v_invoice.supplier,
    'roll_quantity', v_invoice.roll_quantity,
    'vehicle_number', v_invoice.vehicle_number,
    'document_share_date', v_invoice.document_share_date,
    'shipment_type', v_invoice.shipment_type
  );

  v_after := jsonb_build_object(
    'invoice_number', v_number,
    'supplier', v_supplier,
    'roll_quantity', p_roll_quantity,
    'vehicle_number', v_vehicle,
    'document_share_date', p_document_share_date,
    'shipment_type', p_shipment_type
  );

  select coalesce(
    jsonb_object_agg(
      previous.key,
      jsonb_build_object(
        'old', previous.value,
        'new', current_value.value
      )
    ),
    '{}'::jsonb
  )
  into v_changes
  from jsonb_each(v_before) as previous
  join jsonb_each(v_after) as current_value
    on current_value.key = previous.key
  where previous.value is distinct from current_value.value;

  if v_changes = '{}'::jsonb then
    return v_invoice.version;
  end if;

  update public.invoices
  set
    invoice_number = v_number,
    supplier = v_supplier,
    roll_quantity = p_roll_quantity,
    vehicle_number = v_vehicle,
    document_share_date = p_document_share_date,
    shipment_type = p_shipment_type,
    updated_by = v_actor.id,
    updated_at = now(),
    version = version + 1
  where id = p_invoice_id
  returning version into v_version;

  insert into public.activity_logs (
    invoice_id, actor_id, actor_name,
    action, entity_type, entity_id, changes
  )
  values (
    p_invoice_id,
    v_actor.id,
    v_actor.full_name,
    'INVOICE_DETAILS_UPDATED',
    'invoice',
    p_invoice_id,
    v_changes
  );

  return v_version;
end;
$$;

revoke all on function public.create_invoice_v2(
  text, text, integer, text, date, text, text
) from public, anon, authenticated;

grant execute on function public.create_invoice_v2(
  text, text, integer, text, date, text, text
) to authenticated;

revoke all on function public.update_invoice_details_v2(
  uuid, integer, text, text, integer, date, text, text
) from public, anon, authenticated;

grant execute on function public.update_invoice_details_v2(
  uuid, integer, text, text, integer, date, text, text
) to authenticated;

commit;