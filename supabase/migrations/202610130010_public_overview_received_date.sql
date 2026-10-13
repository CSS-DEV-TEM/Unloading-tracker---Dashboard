begin;

create or replace function public.get_public_invoice_overview_v3(
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
  v_result jsonb;
  v_items jsonb;
begin
  v_result := public.get_public_invoice_overview_v2(
    p_search => p_search,
    p_status => p_status,
    p_page => p_page,
    p_system => p_system
  );

  select coalesce(
    jsonb_agg(
      entry.item || jsonb_build_object(
        'pending_reason',
        case
          when i.status = 'Pending'
            and entry.item ->> 'status' = 'Pending'
          then nullif(btrim(i.pending_reason), '')
          else null
        end,
        'vehicle_received_date',
        v.received_date
      )
      order by entry.position
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(
    coalesce(v_result -> 'items', '[]'::jsonb)
  ) with ordinality as entry(item, position)
  left join public.invoices i
    on i.id = (entry.item ->> 'id')::uuid
  left join public.vehicles v
    on v.id = i.vehicle_id;

  return jsonb_set(v_result, '{items}', v_items);
end;
$function$;

revoke all on function public.get_public_invoice_overview_v3(
  text, text, integer, text
) from public, anon, authenticated;

grant execute on function public.get_public_invoice_overview_v3(
  text, text, integer, text
) to anon, authenticated;

commit;