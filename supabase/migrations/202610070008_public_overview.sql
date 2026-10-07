begin;

create or replace function public.get_public_invoice_overview(
  p_search text default '',
  p_status text default '',
  p_page integer default 1
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := btrim(coalesce(p_search, ''));
  v_status text := coalesce(p_status, '');
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

  if v_page < 1 or v_page > 100000 then
    raise exception 'Invalid page.'
      using errcode = '22023';
  end if;

  with matching as materialized (
    select
      i.id,
      i.invoice_number,
      i.supplier,
      i.status,
      i.completed_at,
      i.created_at
    from public.invoices i
    where
      (v_status = '' or i.status = v_status)
      and (
        v_search = ''
        or strpos(lower(i.invoice_number), lower(v_search)) > 0
        or strpos(lower(i.supplier), lower(v_search)) > 0
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
            'invoice_number', r.invoice_number,
            'supplier', r.supplier,
            'status', r.status,
            'started_at', (
              select min(s.started_at)
              from public.pre_grn_stages s
              where s.invoice_id = r.id
            ),
            'completed_at',
              case
                when r.status = 'Complete' then r.completed_at
                else null
              end
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
$$;

revoke all on function
  public.get_public_invoice_overview(text, text, integer)
from public, anon, authenticated;

grant usage on schema public to anon;

grant execute on function
  public.get_public_invoice_overview(text, text, integer)
to anon, authenticated;

commit;