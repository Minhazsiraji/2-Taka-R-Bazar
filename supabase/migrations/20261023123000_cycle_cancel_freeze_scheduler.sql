-- Open commitments are revocable without phantom members. Once closed, quote
-- cancellation is the only available exit, preserving historical accounting.
create or replace function public.leave_simple_sale_group_deal(p_offer uuid,p_product uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();c uuid;a uuid;removed int;
begin
 if u is null then return false;end if;
 select cy.id,cy.community_id into c,a from public.simple_sale_cycles cy
 join public.simple_sale_cycle_members m on m.cycle_id=cy.id and m.customer_id=u
 where cy.offer_id=p_offer and cy.status='open' limit 1;
 if c is null then return false;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_offer::text||':'||a::text,84199));
 perform 1 from public.simple_sale_cycles where id=c and status='open' for update;
 if not found then return false;end if;
 delete from public.simple_sale_cycle_items
 where cycle_id=c and customer_id=u and product_id=p_product;
 get diagnostics removed=row_count;
 if removed=0 then return false;end if;
 delete from public.simple_sale_cycle_members m where m.cycle_id=c and m.customer_id=u
 and not exists(select 1 from public.simple_sale_cycle_items i
   where i.cycle_id=c and i.customer_id=u);
 update public.simple_sale_offer_joins set status='cancelled',updated_at=now()
 where offer_id=p_offer and product_id=p_product and customer_id=u and status='active';
 delete from public.simple_sale_commitment_items
 where offer_id=p_offer and product_id=p_product and customer_id=u;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(u,'group_deal_left','Commitment removed',
  'Your open community commitment was removed. No paid order was created.',
  '/account/commitments','normal','cycle_leave:'||c||':'||p_product||':'||u)
 on conflict(user_id,dedupe_key) do update set read_at=null,created_at=now();
 return true;
end $$;
revoke all on function public.leave_simple_sale_group_deal(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.leave_simple_sale_group_deal(uuid,uuid) to authenticated;

-- Prevent changing live customer tier promises after at least one household joins.
-- Already closed snapshots never change. Editing an unjoined/new cycle is allowed.
create or replace function private.freeze_committed_offer_pricing()
returns trigger language plpgsql security definer set search_path='' as $$
declare offer uuid;
begin
 if tg_op='DELETE' then offer:=old.offer_id; else offer:=new.offer_id;end if;
 if exists(select 1 from public.simple_sale_cycles cy
  join public.simple_sale_cycle_members m on m.cycle_id=cy.id
  where cy.offer_id=offer and cy.status='open') then
  raise exception 'Offer tiers, products or assigned communities cannot change during an active customer cycle';
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function private.freeze_committed_offer_pricing() from public,anon,authenticated,service_role;
create trigger freeze_offer_tiers_while_joined before insert or update or delete
 on public.simple_sale_offer_tiers for each row execute function private.freeze_committed_offer_pricing();
create trigger freeze_offer_items_while_joined before insert or update or delete
 on public.simple_sale_offer_items for each row execute function private.freeze_committed_offer_pricing();
create trigger freeze_offer_communities_while_joined before insert or update or delete
 on public.simple_sale_offer_communities for each row execute function private.freeze_committed_offer_pricing();

-- Supabase pg_cron executes the private settlement coordinator every five minutes.
-- The CI pipeline disables all operational cron jobs after resetting its disposable DB.
do $cron$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') and
  not exists(select 1 from cron.job where jobname='2tbr-community-cycle-settlement') then
   perform cron.schedule('2tbr-community-cycle-settlement','*/5 * * * *',
     'select private.close_due_simple_sale_cycles_impl();');
 end if;
end $cron$;
