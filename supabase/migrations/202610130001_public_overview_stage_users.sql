begin;

create or replace function public.get_public_invoice_overview_v2(
  p_search text default '',
  p_status text default '',
  p_page integer default 1,
  p_system text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text := btrim(coalesce(p_search, ''));
  v_status text := coalesce(p_status, '');
  v_system text := coalesce(p_system, '');
  v_page integer := coalesce(p_page, 1);
  v_result jsonb;
begin
  if char_length(v_search) > 100 then
    raise exception 'Search must be 100 characters or fewer.'
      using errcode = '22023';
  end if;

  if v_status not in ('', 'Pending', 'Complete', 'Reject') then
    raise exception 'Invalid status.'
      using errcode = '22023';
  end if;

  if v_system not in ('', 'AX', 'D365', 'AX/D365') then
    raise exception 'Invalid system.'
      using errcode = '22023';
  end if;

  if v_page < 1 or v_page > 100000 then
    raise exception 'Invalid page.'
      using errcode = '22023';
  end if;

  with matching as materialized (
    select
      i.id,
      i.invoice_number,
      i.vehicle_number,
      i.supplier,
      i.system_type,
      i.shipment_type,
      i.document_share_date,
      i.roll_quantity,
      i.status,
      i.completed_at,
      i.created_at
    from public.invoices i
    where
      (v_status = '' or i.status = v_status)
      and (v_system = '' or i.system_type = v_system)
      and (
        v_search = ''
        or strpos(
          lower(i.invoice_number),
          lower(v_search)
        ) > 0
        or strpos(
          lower(i.supplier),
          lower(v_search)
        ) > 0
        or strpos(
          lower(coalesce(i.vehicle_number, '')),
          lower(v_search)
        ) > 0
      )
  ),
  page_rows as (
    select *
    from matching
    order by created_at desc, id desc
    limit 20
    offset ((v_page - 1) * 20)
  )
  select jsonb_build_object(
    'total', (select count(*) from matching),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'invoice_number', r.invoice_number,
            'vehicle_number', r.vehicle_number,
            'supplier', r.supplier,
            'system_type', r.system_type,
            'shipment_type', r.shipment_type,
            'document_share_date', r.document_share_date,
            'roll_quantity', r.roll_quantity,
            'status', r.status,
            'started_at', (
              select min(s.started_at)
              from public.pre_grn_stages s
              where s.invoice_id = r.id
            ),
            'completed_at', case
              when r.status = 'Complete' then r.completed_at
              else null
            end,
            'stages', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'system_name', s.system_name,
                    'started_at', s.started_at,
                    'ended_at', s.ended_at, 
                    'is_done', s.is_done,
                    'assigned_user_name', s.assigned_user_name
                  )
                  order by s.system_name
                )
                from public.pre_grn_stages s
                where s.invoice_id = r.id
              ),
              '[]'::jsonb
            ),
            'asn', (
              select jsonb_build_object(
                'is_shared', a.is_shared,
                'share_date', a.share_date,
                'assigned_user_name', a.assigned_user_name
              )
              from public.asn_updates a
              where a.invoice_id = r.id
            )
          )
          order by r.created_at desc, r.id desc
        )
        from page_rows r
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_public_invoice_overview_v2(
  text, text, integer, text
) from public, anon, authenticated;

grant execute on function public.get_public_invoice_overview_v2(
  text, text, integer, text
) to anon, authenticated;

commit;