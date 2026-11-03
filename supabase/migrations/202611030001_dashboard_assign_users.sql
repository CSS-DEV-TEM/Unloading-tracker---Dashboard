begin;
create or replace function public.invoice_quick_assign_users(
 p_invoice_id uuid, p_field text default null, p_user_name text default null,
 p_expected_version integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 actor public.profiles%rowtype;
 inv public.invoices%rowtype;
 old_name text;
 new_name text := nullif(btrim(p_user_name), '');
begin
 select * into actor from public.profiles
 where id = auth.uid() and is_active and role in ('ADMIN','USER') for share;
 if not found then raise exception 'Active dashboard access required' using errcode='42501'; end if;
 select * into inv from public.invoices where id=p_invoice_id for update;
 if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
 if p_field is not null then
  if p_field not in ('AX','D365','ASN') then raise exception 'Invalid field' using errcode='22023'; end if;
  if p_expected_version is null or p_expected_version <> inv.version then
   raise exception 'Invoice changed; reload users' using errcode='40001';
  end if;
  if new_name is not null then
   if length(new_name)>150 then raise exception 'Name too long' using errcode='22023'; end if;
   perform 1 from public.profiles where is_active and full_name=new_name for share;
   if not found then raise exception 'Select an active user' using errcode='22023'; end if;
  end if;
  if p_field='ASN' then
   select assigned_user_name into old_name from public.asn_updates where invoice_id=p_invoice_id for update;
  else
   if not (inv.system_type=p_field or inv.system_type='AX/D365') then
    raise exception 'System does not belong to invoice' using errcode='22023';
   end if;
   select assigned_user_name into old_name from public.pre_grn_stages
   where invoice_id=p_invoice_id and system_name=p_field for update;
  end if;
  if not found then raise exception 'Processing record missing' using errcode='P0002'; end if;
  if old_name is distinct from new_name then
   if p_field='ASN' then
    update public.asn_updates set assigned_user_name=new_name, assigned_user_id=null where invoice_id=p_invoice_id;
   else
    update public.pre_grn_stages set assigned_user_name=new_name, assigned_user_id=null
    where invoice_id=p_invoice_id and system_name=p_field;
   end if;
   update public.invoices set version=version+1, updated_by=actor.id, updated_at=now()
   where id=p_invoice_id returning * into inv;
   insert into public.activity_logs(invoice_id,actor_id,actor_name,action,entity_type,entity_id,changes)
   values(p_invoice_id,actor.id,actor.full_name,'INVOICE_PROCESS_UPDATED','invoice',p_invoice_id,
    jsonb_build_object(case when p_field='ASN' then 'asn.assigned_user_name' else p_field||'.assigned_user_name' end,
     jsonb_build_object('old',old_name,'new',new_name)));
  end if;
 end if;
 return jsonb_build_object('version',inv.version,
  'stages',coalesce((select jsonb_agg(jsonb_build_object('system_name',s.system_name,'assigned_user_name',s.assigned_user_name) order by s.system_name)
   from public.pre_grn_stages s where s.invoice_id=p_invoice_id),'[]'::jsonb),
  'asn_user_name',(select assigned_user_name from public.asn_updates where invoice_id=p_invoice_id),
  'user_names',coalesce((select jsonb_agg(n.full_name order by n.full_name) from
    (select distinct full_name from public.profiles where is_active and length(btrim(full_name)) between 1 and 150) n),'[]'::jsonb));
end;
$$;
revoke all on function public.invoice_quick_assign_users(uuid,text,text,integer) from public, anon;
grant execute on function public.invoice_quick_assign_users(uuid,text,text,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
