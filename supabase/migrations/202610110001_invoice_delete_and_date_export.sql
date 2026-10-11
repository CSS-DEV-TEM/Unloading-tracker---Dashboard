begin;

-- Preserve invoice identity after the original invoice is deleted.
alter table public.activity_logs
  add column invoice_number_snapshot text;

update public.activity_logs as logs
set invoice_number_snapshot = invoices.invoice_number
from public.invoices as invoices
where logs.invoice_id = invoices.id;

create index activity_invoice_number_snapshot_idx
  on public.activity_logs(invoice_number_snapshot);

create index invoices_document_date_idx
  on public.invoices(document_share_date, id);

-- New activity records retain the invoice number at the time of the event.
create function public.capture_activity_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invoice_id is not null
     and new.invoice_number_snapshot is null then
    select i.invoice_number
    into new.invoice_number_snapshot
    from public.invoices i
    where i.id = new.invoice_id;
  end if;

  return new;
end;
$$;

revoke all on function public.capture_activity_invoice_number()
from public, anon, authenticated;

create trigger capture_activity_invoice_number
before insert on public.activity_logs
for each row
execute function public.capture_activity_invoice_number();

-- Keep audit history when the invoice is removed.
alter table public.activity_logs
  drop constraint activity_logs_invoice_id_fkey;

alter table public.activity_logs
  add constraint activity_logs_invoice_id_fkey
  foreign key (invoice_id)
  references public.invoices(id)
  on delete set null;

create function public.delete_invoice(
  p_invoice_id uuid,
  p_expected_version integer,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_invoice public.invoices%rowtype;
  v_stages jsonb;
  v_asn jsonb;
begin
  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and role = 'ADMIN'
    and is_active = true
  for share;

  if not found then
    raise exception 'Active administrator access required.'
      using errcode = '42501';
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

  if p_expected_version is null
     or v_invoice.version <> p_expected_version then
    raise exception 'Invoice changed. Reload before deleting.'
      using errcode = '40001';
  end if;

  if p_confirmation is distinct from v_invoice.invoice_number then
    raise exception 'Invoice number confirmation does not match.'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(s) order by s.system_name),
    '[]'::jsonb
  )
  into v_stages
  from public.pre_grn_stages s
  where s.invoice_id = p_invoice_id;

  select to_jsonb(a)
  into v_asn
  from public.asn_updates a
  where a.invoice_id = p_invoice_id;

  -- Retain snapshots for any older records without one.
  update public.activity_logs
  set invoice_number_snapshot = v_invoice.invoice_number
  where invoice_id = p_invoice_id
    and invoice_number_snapshot is null;

  insert into public.activity_logs (
    invoice_id,
    invoice_number_snapshot,
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    changes
  )
  values (
    p_invoice_id,
    v_invoice.invoice_number,
    v_actor.id,
    v_actor.full_name,
    'INVOICE_DELETED',
    'invoice',
    p_invoice_id,
    jsonb_build_object(
      'invoice_number', jsonb_build_object(
        'old', v_invoice.invoice_number,
        'new', null
      ),
      'supplier', jsonb_build_object(
        'old', v_invoice.supplier,
        'new', null
      ),
      'deleted_invoice', to_jsonb(v_invoice),
      'deleted_stages', v_stages,
      'deleted_asn', v_asn
    )
  );

  delete from public.pre_grn_stages
  where invoice_id = p_invoice_id;

  delete from public.asn_updates
  where invoice_id = p_invoice_id;

  delete from public.invoices
  where id = p_invoice_id;
end;
$$;

revoke all on function public.delete_invoice(uuid, integer, text)
from public, anon, authenticated;

grant execute on function public.delete_invoice(uuid, integer, text)
to authenticated;

-- Separate function avoids changing the existing all-invoices RPC.
create function public.prepare_invoice_export_range(
  p_from_date date,
  p_to_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_rows jsonb;
  v_count integer;
begin
  select *
  into v_actor
  from public.profiles
  where id = auth.uid()
    and role = 'ADMIN'
    and is_active = true
  for share;

  if not found then
    raise exception 'Active administrator access required.'
      using errcode = '42501';
  end if;

  if p_from_date is null
     or p_to_date is null
     or not isfinite(p_from_date)
     or not isfinite(p_to_date)
     or p_from_date > p_to_date then
    raise exception 'Select a valid document date range.'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'invoice', to_jsonb(i),
        'stages', (
          select coalesce(
            jsonb_agg(to_jsonb(s) order by s.system_name),
            '[]'::jsonb
          )
          from public.pre_grn_stages s
          where s.invoice_id = i.id
        ),
        'asn', (
          select to_jsonb(a)
          from public.asn_updates a
          where a.invoice_id = i.id
        )
      )
      order by i.document_share_date, i.id
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select *
    from public.invoices
    where document_share_date >= p_from_date
      and document_share_date <= p_to_date
    order by document_share_date, id
    limit 10001
  ) i;

  v_count := jsonb_array_length(v_rows);

  if v_count > 10000 then
    raise exception 'More than 10000 invoices. Select a smaller range.'
      using errcode = '54000';
  end if;

  if v_count = 0 then
    return v_rows;
  end if;

  insert into public.activity_logs (
    actor_id,
    actor_name,
    action,
    entity_type,
    changes
  )
  values (
    v_actor.id,
    v_actor.full_name,
    'INVOICE_EXPORT_REQUESTED',
    'invoice_export',
    jsonb_build_object(
      'scope', 'Document date range',
      'from_date', p_from_date,
      'to_date', p_to_date,
      'invoice_count', v_count
    )
  );

  return v_rows;
end;
$$;

revoke all on function public.prepare_invoice_export_range(date, date)
from public, anon, authenticated;

grant execute on function public.prepare_invoice_export_range(date, date)
to authenticated;

commit;