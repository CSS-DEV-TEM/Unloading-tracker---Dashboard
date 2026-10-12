-- Apply after 202610120003_vehicle_management.sql. Do not rerun the earlier migration.
begin;

alter table public.vehicles add column if not exists is_archived boolean not null default false;

create or replace function private.resolve_vehicle(p_number text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles%rowtype; v_number text := upper(btrim(p_number)); v_id uuid; v_created boolean;
begin
  select * into v_actor from public.profiles where id = auth.uid() and is_active and role in ('ADMIN','USER') for share;
  if not found then raise exception 'Active access required.' using errcode = '42501'; end if;
  if nullif(v_number,'') is null then return null; end if;
  if char_length(v_number) > 30 or private.vehicle_key(v_number) = '' then
    raise exception 'Enter a vehicle number of up to 30 characters.' using errcode = '22023';
  end if;
  insert into public.vehicles(vehicle_number) values(v_number)
  on conflict(number_key) do nothing returning id into v_id;
  v_created := found;
  if not v_created then
    select id into v_id from public.vehicles where number_key = private.vehicle_key(v_number) for share;
    if found and exists(select 1 from public.vehicles where id=v_id and is_archived) then
      raise exception 'Vehicle is archived. Ask an administrator to restore it.' using errcode='PVA01';
    end if;
    if not found then raise exception 'Vehicle changed. Try again.' using errcode = '40001'; end if;
  else
    insert into public.activity_logs(actor_id,actor_name,action,entity_type,entity_id,changes)
    values(v_actor.id,v_actor.full_name,'VEHICLE_CREATED','vehicle',v_id,
      jsonb_build_object('vehicle_number',jsonb_build_object('old',null,'new',v_number)));
  end if;
  return v_id;
end;
$$;

create or replace function private.sync_invoice_vehicle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_vehicle public.vehicles%rowtype; v_new_assignment boolean;
begin
  if TG_OP = 'INSERT' then
    if new.vehicle_id is null then new.vehicle_id := private.resolve_vehicle(new.vehicle_number); end if;
  elsif new.vehicle_id is not distinct from old.vehicle_id
    and new.vehicle_number is distinct from old.vehicle_number then
    -- Preserve an existing link during canonicalization or registry renaming,
    -- including an archived vehicle. Any different target must be active.
    if old.vehicle_id is not null then
      select * into v_vehicle from public.vehicles where id=old.vehicle_id for share;
    end if;
    if v_vehicle.id is null or v_vehicle.number_key is distinct from private.vehicle_key(new.vehicle_number) then
      new.vehicle_id := private.resolve_vehicle(new.vehicle_number);
    end if;
  end if;
  if new.vehicle_id is null then new.vehicle_number := null;
  else
    select * into v_vehicle from public.vehicles where id=new.vehicle_id for share;
    if not found then raise exception 'Vehicle not found.' using errcode='P0002'; end if;
    v_new_assignment := TG_OP = 'INSERT';
    if TG_OP = 'UPDATE' then v_new_assignment := new.vehicle_id is distinct from old.vehicle_id; end if;
    if v_new_assignment and v_vehicle.is_archived then
      raise exception 'Vehicle is archived. Restore it before assigning invoices.' using errcode='PVA01';
    end if;
    new.vehicle_number := v_vehicle.vehicle_number;
  end if;
  if TG_OP = 'UPDATE' then
    if new.vehicle_id is distinct from old.vehicle_id or new.vehicle_number is distinct from old.vehicle_number then
      new.version := old.version + 1;
      new.updated_at := now();
      new.updated_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.assign_vehicle_invoices(p_vehicle_id uuid, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_row record; v_current public.invoices%rowtype; v_count integer := 0;
begin
  select id into v_actor from public.profiles where id=auth.uid() and is_active and role in ('ADMIN','USER') for share;
  if not found then raise exception 'Active access required.' using errcode='42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid selection.' using errcode='22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Select 1 to 50 invoices.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_to_recordset(p_items) as x(id uuid, version integer) where id is null or version is null or version < 1)
    or (select count(*) <> count(distinct id) from jsonb_to_recordset(p_items) as x(id uuid, version integer)) then
    raise exception 'Invalid invoice selection.' using errcode='22023';
  end if;
  if p_vehicle_id is not null then
    perform 1 from public.vehicles where id=p_vehicle_id for share;
    if not found then raise exception 'Vehicle not found.' using errcode='P0002'; end if;
    if exists(select 1 from public.vehicles where id=p_vehicle_id and is_archived) then
      raise exception 'Vehicle is archived. Restore it before assigning invoices.' using errcode='PVA01';
    end if;
  end if;
  -- Lock in a consistent order. Any conflict rolls back the entire batch.
  for v_row in select * from jsonb_to_recordset(p_items) as x(id uuid, version integer) order by id loop
    select * into v_current from public.invoices where id=v_row.id for update;
    if not found then raise exception 'Invoice no longer exists.' using errcode='P0002'; end if;
    if v_current.version is distinct from v_row.version then raise exception 'An invoice changed. Reload and review the selection.' using errcode='40001'; end if;
    if v_current.vehicle_id is distinct from p_vehicle_id then
      update public.invoices set vehicle_id=p_vehicle_id, updated_by=v_actor where id=v_row.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
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

  -- Unchanged archived assignments must not prevent editing other invoice fields.
  if v_vehicle is not null then
    if v_invoice.vehicle_id is not null and
       private.vehicle_key(v_vehicle) = private.vehicle_key(v_invoice.vehicle_number) then
      v_vehicle := v_invoice.vehicle_number;
    else
      select vehicle_number into v_vehicle from public.vehicles
      where id = private.resolve_vehicle(v_vehicle);
    end if;
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

create or replace function public.set_vehicle_archived(
  p_vehicle_id uuid, p_expected_version integer, p_archived boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles%rowtype; v_old public.vehicles%rowtype;
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active and role='ADMIN' for share;
  if not found then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if p_archived is null then raise exception 'Archive state required.' using errcode='22023'; end if;
  select * into v_old from public.vehicles where id=p_vehicle_id for update;
  if not found then raise exception 'Vehicle not found.' using errcode='P0002'; end if;
  if v_old.version is distinct from p_expected_version then raise exception 'Vehicle changed. Reload first.' using errcode='40001'; end if;
  if v_old.is_archived=p_archived then return; end if;
  update public.vehicles set is_archived=p_archived, version=version+1, updated_at=now()
  where id=p_vehicle_id;
  -- Intentionally do not update invoices: assignments, versions and labels remain intact.
  insert into public.activity_logs(actor_id,actor_name,action,entity_type,entity_id,changes)
  values(v_actor.id,v_actor.full_name,case when p_archived then 'VEHICLE_ARCHIVED' else 'VEHICLE_RESTORED' end,
    'vehicle',p_vehicle_id,jsonb_build_object(
      'vehicle_number',jsonb_build_object('old',v_old.vehicle_number,'new',v_old.vehicle_number),
      'is_archived',jsonb_build_object('old',v_old.is_archived,'new',p_archived)));
end;
$$;

create or replace function public.delete_vehicle(
  p_vehicle_id uuid, p_expected_version integer, p_confirmation text
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles%rowtype; v_old public.vehicles%rowtype;
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active and role='ADMIN' for share;
  if not found then raise exception 'Administrator access required.' using errcode='42501'; end if;
  -- Conflicts with assignment locks; the FK remains an additional deletion guard.
  select * into v_old from public.vehicles where id=p_vehicle_id for update;
  if not found then raise exception 'Vehicle not found.' using errcode='P0002'; end if;
  if v_old.version is distinct from p_expected_version then raise exception 'Vehicle changed. Reload first.' using errcode='40001'; end if;
  if p_confirmation is distinct from v_old.vehicle_number then
    raise exception 'Type the vehicle number exactly.' using errcode='22023'; end if;
  if exists(select 1 from public.invoices where vehicle_id=p_vehicle_id) then
    raise exception 'Vehicle has assigned invoices. Archive it instead.' using errcode='23503'; end if;
  delete from public.vehicles where id=p_vehicle_id;
  insert into public.activity_logs(actor_id,actor_name,action,entity_type,entity_id,changes)
  values(v_actor.id,v_actor.full_name,'VEHICLE_DELETED','vehicle',p_vehicle_id,
    jsonb_build_object('vehicle_number',jsonb_build_object('old',v_old.vehicle_number,'new',null),
      'is_archived',jsonb_build_object('old',v_old.is_archived,'new',null)));
end;
$$;

revoke all on function public.set_vehicle_archived(uuid,integer,boolean) from public,anon,authenticated;
revoke all on function public.delete_vehicle(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.set_vehicle_archived(uuid,integer,boolean) to authenticated;
grant execute on function public.delete_vehicle(uuid,integer,text) to authenticated;

commit;