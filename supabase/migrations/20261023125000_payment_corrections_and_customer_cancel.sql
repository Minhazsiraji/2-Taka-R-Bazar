-- Customer cancellation BEFORE transfer and a staff correction path for invalid
-- submitted payment references. No new orders, money movement or refunds here.
create table public.simple_sale_payment_review_events(
 id uuid primary key default gen_random_uuid(),
 quote_id uuid not null references public.simple_sale_cycle_quotes(id) on delete restrict,
 staff_id uuid not null references auth.users(id) on delete restrict,
 action text not null check(action='request_correction'),
 previous_recipient_id uuid references public.pilot_payment_recipients(id),
 previous_reference text,
 reason text not null check(char_length(btrim(reason)) between 10 and 500),
 created_at timestamptz not null default now()
);
alter table public.simple_sale_payment_review_events enable row level security;
revoke all on public.simple_sale_payment_review_events from public,anon,authenticated;
create policy staff_or_customer_read_review on public.simple_sale_payment_review_events
 for select to authenticated using(
  exists(select 1 from public.simple_sale_cycle_quotes q
   where q.id=quote_id and q.customer_id=(select auth.uid()))
  or private.has_role((select auth.uid()),'admin')
  or private.has_role((select auth.uid()),'super_admin'));
grant select on public.simple_sale_payment_review_events to authenticated;

create or replace function public.admin_request_simple_sale_payment_correction(
 p_quote uuid,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;reason_text text;
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin'))
 then raise exception 'Admin access required';end if;
 reason_text:=btrim(coalesce(p_reason,''));
 if char_length(reason_text) not between 10 and 500 then
  raise exception 'Explain why the submitted transfer reference needs correction';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote for update;
 if q.id is null or q.status<>'payment_submitted' or q.order_id is not null
 then raise exception 'Only an unverified transfer reference may be corrected';end if;
 insert into public.simple_sale_payment_review_events(quote_id,staff_id,action,
  previous_recipient_id,previous_reference,reason)
 values(q.id,u,'request_correction',q.payment_recipient_id,q.payment_reference,reason_text);
 update public.simple_sale_cycle_quotes set status='accepted',payment_recipient_id=null,
  payment_reference=null,payment_submitted_at=null,updated_at=now()
 where id=q.id;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(q.customer_id,'shared_payment_correction','Please correct transfer information',
  'Staff could not match your submitted transfer: '||reason_text||
  '. Re-check your transaction details. No order has been created.',
  '/account/commitments','normal','shared_payment_correction:'||q.id)
 on conflict(user_id,dedupe_key) do update set read_at=null,body=excluded.body,created_at=now();
 return true;
end $$;
revoke all on function public.admin_request_simple_sale_payment_correction(uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_request_simple_sale_payment_correction(uuid,text) to authenticated;

-- Preserve the customer's right to cancel after accepting but BEFORE submitting payment.
create or replace function public.customer_decide_simple_sale_quote(
 p_quote uuid,p_decision text,p_name text default null,p_phone text default null,p_terms boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;
begin
 if u is null then raise exception 'Sign in first';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote and customer_id=u for update;
 if q.id is null or q.status not in ('quoted','awaiting_delivery','accepted') then
  raise exception 'This quote is not awaiting a decision';end if;
 if p_decision='cancel' then
  if q.payment_reference is not null or q.payment_submitted_at is not null
  then raise exception 'Submitted transfers require staff resolution';end if;
  update public.simple_sale_cycle_quotes set status='cancelled',updated_at=now() where id=q.id;
  return true;
 end if;
 if p_decision<>'accept' or q.status<>'quoted' or q.delivery_fee is null
 then raise exception 'A complete staff quote must be available';end if;
 if p_terms is distinct from true then raise exception 'Explicitly accept the final price and terms';end if;
 if char_length(btrim(coalesce(p_name,''))) not between 2 and 100 or
  coalesce(p_phone,'') !~ '^\+?[0-9]{10,15}$'
 then raise exception 'Enter a valid name and mobile number';end if;
 update public.simple_sale_cycle_quotes set status='accepted',accepted_at=now(),
  contact_name=btrim(p_name),contact_phone=p_phone,updated_at=now()
 where id=q.id;
 return true;
end $$;
revoke all on function public.customer_decide_simple_sale_quote(uuid,text,text,text,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.customer_decide_simple_sale_quote(uuid,text,text,text,boolean) to authenticated;
