begin;

create or replace function public.notify_unloading_overview_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    '{}'::jsonb,
    'overview_changed',
    'unloading-overview-v1',
    false
  );

  return null;
end;
$$;

revoke all
on function public.notify_unloading_overview_changed()
from public, anon, authenticated;

drop trigger if exists unloading_overview_changed
on public.invoices;

create trigger unloading_overview_changed
after insert or update or delete
on public.invoices
for each statement
execute function public.notify_unloading_overview_changed();

drop trigger if exists unloading_overview_changed
on public.pre_grn_stages;

create trigger unloading_overview_changed
after insert or update or delete
on public.pre_grn_stages
for each statement
execute function public.notify_unloading_overview_changed();

drop trigger if exists unloading_overview_changed
on public.asn_updates;

create trigger unloading_overview_changed
after insert or update or delete
on public.asn_updates
for each statement
execute function public.notify_unloading_overview_changed();

commit;