begin;

create or replace function public.update_invoice_details(
  p_invoice_id uuid,
  p_expected_version integer,
  p_invoice_number text,
  p_supplier text,
  p_roll_quantity integer,
  p_document_share_date date,
  p_shipment_type text
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
    raise exception 'Active user access required.'
      using errcode = '42501';
  end if;

  if v_number is null or char_length(v_number) not between 1 and 100 then
    raise exception 'Invalid invoice number.'
      using errcode = '22023';
  end if;

  if v_supplier is null or char_length(v_supplier) not between 1 and 250 then
    raise exception 'Invalid supplier.'
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
    'document_share_date', v_invoice.document_share_date,
    'shipment_type', v_invoice.shipment_type
  );

  v_after := jsonb_build_object(
    'invoice_number', v_number,
    'supplier', v_supplier,
    'roll_quantity', p_roll_quantity,
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
    document_share_date = p_document_share_date,
    shipment_type = p_shipment_type,
    updated_by = v_actor.id,
    updated_at = now(),
    version = version + 1
  where id = p_invoice_id
  returning version into v_version;

  insert into public.activity_logs (
    invoice_id,
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    changes
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

revoke all on function public.update_invoice_details(
  uuid, integer, text, text, integer, date, text
) from public, anon, authenticated;

grant execute on function public.update_invoice_details(
  uuid, integer, text, text, integer, date, text
) to authenticated;

commit;