-- Shared commitments must always have a deterministic settlement deadline.
-- The maximum tier can close earlier, but unmet tiers cannot hold customers forever.
create or replace function private.ensure_shared_cycle_deadline()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='open' and new.closes_at is null then
  new.closes_at:=coalesce(new.opened_at,now())+interval '7 days';
 end if;
 return new;
end $$;

create trigger ensure_shared_cycle_deadline_before_save
before insert or update of closes_at on public.simple_sale_cycles
for each row execute function private.ensure_shared_cycle_deadline();

-- Existing undated open cycles receive a fresh seven-day settlement window.
-- Closed historical quotes/cycles are never rewritten.
update public.simple_sale_cycles
set closes_at=now()+interval '7 days'
where status='open' and closes_at is null;
