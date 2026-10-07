begin;

create or replace function public.prepare_invoice_export()
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

  -- Read invoices and related records in one statement.
  -- Fetch one extra row so we can reject oversized exports.
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
      order by i.created_at desc, i.id desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select *
    from public.invoices
    order by created_at desc, id desc
    limit 10001
  ) i;

  v_count := jsonb_array_length(v_rows);

  if v_count > 10000 then
    raise exception 'Export exceeds the 10000 invoice limit.'
      using errcode = '54000';
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
      'scope', jsonb_build_object(
        'old', null,
        'new', 'All invoices'
      ),
      'invoice_count', jsonb_build_object(
        'old', null,
        'new', v_count
      )
    )
  );

  return v_rows;
end;
$$;

revoke all on function public.prepare_invoice_export()
from public, anon, authenticated;

grant execute on function public.prepare_invoice_export()
to authenticated;

commit;