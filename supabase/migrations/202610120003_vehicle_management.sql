begin;

create function private.vehicle_key(p_number text)
returns text language sql immutable set search_path = '' as $$
  select upper(regexp_replace(btrim(coalesce(p_number, '')), '[[:space:]-]+', '', 'g'));
$$;
revoke all on function private.vehicle_key(text) from public, anon, authenticated;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_number text not null check (char_length(btrim(vehicle_number)) between 1 and 30),
  number_key text generated always as (private.vehicle_key(vehicle_number)) stored unique,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (number_key <> '')
);
alter table public.vehicles enable row level security;
revoke all on public.vehicles from public, anon, authenticated;
grant select on public.vehicles to authenticated;
create policy vehicles_read on public.vehicles for select to authenticated
using ((select private.current_active_role()) in ('ADMIN', 'USER'));

alter table public.invoices add column vehicle_id uuid references public.vehicles(id) on delete restrict;
create index invoices_vehicle_id_idx on public.invoices(vehicle_id);

-- Preserve existing assignments and merge only case/spacing/hyphen equivalents.
-- Unusual existing values are rejected, never silently discarded.
do $$ begin
  if exists (select 1 from public.invoices where nullif(btrim(vehicle_number), '') is not null
    and private.vehicle_key(vehicle_number) = '') then
    raise exception 'An existing vehicle number contains only spaces/hyphens. Correct it before migration.';
  end if;
end $$;
insert into public.vehicles(vehicle_number)
select distinct on (private.vehicle_key(vehicle_number)) upper(btrim(vehicle_number))
from public.invoices
where nullif(btrim(vehicle_number), '') is not null
order by private.vehicle_key(vehicle_number), created_at, id;
update public.invoices i set vehicle_id = v.id, vehicle_number = v.vehicle_number
from public.vehicles v where private.vehicle_key(i.vehicle_number) = v.number_key;

create function private.resolve_vehicle(p_number text)
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
    if not found then raise exception 'Vehicle changed. Try again.' using errcode = '40001'; end if;
  else
    insert into public.activity_logs(actor_id,actor_name,action,entity_type,entity_id,changes)
    values(v_actor.id,v_actor.full_name,'VEHICLE_CREATED','vehicle',v_id,
      jsonb_build_object('vehicle_number',jsonb_build_object('old',null,'new',v_number)));
  end if;
  return v_id;
end;
$$;
revoke all on function private.resolve_vehicle(text) from public, anon, authenticated;

-- vehicle_number is a compatibility display/search cache; vehicle_id links to the registry.
-- Existing create/edit RPCs continue to work and auto-create/reuse vehicles transactionally.
create function private.sync_invoice_vehicle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.vehicle_id is null then new.vehicle_id := private.resolve_vehicle(new.vehicle_number); end if;
  elsif new.vehicle_id is not distinct from old.vehicle_id
    and new.vehicle_number is distinct from old.vehicle_number then
    new.vehicle_id := private.resolve_vehicle(new.vehicle_number);
  end if;
  if new.vehicle_id is null then new.vehicle_number := null;
  else
    select vehicle_number into new.vehicle_number from public.vehicles where id = new.vehicle_id for share;
    if not found then raise exception 'Vehicle not found.' using errcode = 'P0002'; end if;
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
revoke all on function private.sync_invoice_vehicle() from public, anon, authenticated;
create trigger invoice_vehicle_sync before insert or update of vehicle_id,vehicle_number
on public.invoices for each row execute function private.sync_invoice_vehicle();

create function private.audit_invoice_vehicle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if new.vehicle_id is distinct from old.vehicle_id or new.vehicle_number is distinct from old.vehicle_number then
    select full_name into v_name from public.profiles where id = auth.uid();
    insert into public.activity_logs(invoice_id,actor_id,actor_name,action,entity_type,entity_id,changes)
    values(new.id,auth.uid(),v_name,'INVOICE_VEHICLE_UPDATED','invoice',new.id,
      jsonb_build_object('vehicle_number',jsonb_build_object('old',old.vehicle_number,'new',new.vehicle_number)));
  end if;
  return new;
end;
$$;
revoke all on function private.audit_invoice_vehicle() from public, anon, authenticated;
create trigger invoice_vehicle_audit after update of vehicle_id,vehicle_number
on public.invoices for each row execute function private.audit_invoice_vehicle();

create function public.add_vehicle(p_number text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if nullif(btrim(p_number),'') is null then raise exception 'Vehicle number required.' using errcode='22023'; end if;
  return private.resolve_vehicle(p_number);
end;
$$;

create function public.assign_vehicle_invoices(p_vehicle_id uuid, p_items jsonb)
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

create function public.rename_vehicle(p_vehicle_id uuid,p_expected_version integer,p_number text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles%rowtype; v_old public.vehicles%rowtype; v_number text := upper(btrim(p_number));
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active and role='ADMIN' for share;
  if not found then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if v_number is null or char_length(v_number) not between 1 and 30 or private.vehicle_key(v_number)='' then
    raise exception 'Invalid vehicle number.' using errcode='22023'; end if;
  select * into v_old from public.vehicles where id=p_vehicle_id for update;
  if not found then raise exception 'Vehicle not found.' using errcode='P0002'; end if;
  if v_old.version is distinct from p_expected_version then raise exception 'Vehicle changed. Reload first.' using errcode='40001'; end if;
  if v_old.vehicle_number=v_number then return; end if;
  update public.vehicles set vehicle_number=v_number,version=version+1,updated_at=now() where id=p_vehicle_id;
  update public.invoices set vehicle_number=v_number where vehicle_id=p_vehicle_id;
  insert into public.activity_logs(actor_id,actor_name,action,entity_type,entity_id,changes)
  values(v_actor.id,v_actor.full_name,'VEHICLE_RENAMED','vehicle',p_vehicle_id,
    jsonb_build_object('vehicle_number',jsonb_build_object('old',v_old.vehicle_number,'new',v_number)));
end;
$$;

create trigger vehicles_overview_changed after insert or update or delete on public.vehicles
for each statement execute function public.notify_unloading_overview_changed();

revoke all on function public.add_vehicle(text) from public,anon,authenticated;
revoke all on function public.assign_vehicle_invoices(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.rename_vehicle(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.add_vehicle(text) to authenticated;
grant execute on function public.assign_vehicle_invoices(uuid,jsonb) to authenticated;
grant execute on function public.rename_vehicle(uuid,integer,text) to authenticated;
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

  -- Canonical registry value also feeds the existing details audit event.
  if v_vehicle is not null then
    select vehicle_number into v_vehicle from public.vehicles
    where id = private.resolve_vehicle(v_vehicle);
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


commit;