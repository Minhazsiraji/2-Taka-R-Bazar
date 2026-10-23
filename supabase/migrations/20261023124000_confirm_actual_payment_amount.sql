-- Force financial attestation at DATABASE RPC boundary, not merely in the browser.
-- Move previous one-parameter verifier out of public API. It remains a private
-- privileged implementation callable only from this authenticated amount gate.
alter function public.admin_verify_simple_sale_payment(uuid) set schema private;
revoke all on function private.admin_verify_simple_sale_payment(uuid)
 from public,anon,authenticated,service_role;

create function public.admin_verify_simple_sale_payment(
 p_quote uuid,p_verified_amount numeric,p_bank_confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();q public.simple_sale_cycle_quotes%rowtype;expected_amount numeric(12,2);
begin
 if u is null or not(private.has_role(u,'admin') or private.has_role(u,'super_admin'))
 then raise exception 'Independent authorized staff review required';end if;
 if p_bank_confirmed is distinct from true
 then raise exception 'Confirm that you checked the actual official bank or bKash transaction';end if;
 if p_verified_amount is null or p_verified_amount::text in ('NaN','Infinity','-Infinity')
 or p_verified_amount<=0 or p_verified_amount<>round(p_verified_amount,2)
 then raise exception 'Supply the exact received payment amount';end if;
 select * into q from public.simple_sale_cycle_quotes where id=p_quote for update;
 if q.id is null or q.status not in ('payment_submitted','verified')
 or q.delivery_fee is null or q.accepted_at is null
 then raise exception 'Only an accepted and submitted transfer may be verified';end if;
 expected_amount:=q.product_total+q.delivery_fee;
 if p_verified_amount<>expected_amount
 then raise exception 'Received transfer must match the accepted product and delivery total';end if;
 return private.admin_verify_simple_sale_payment(p_quote);
end $$;
revoke all on function public.admin_verify_simple_sale_payment(uuid,numeric,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_verify_simple_sale_payment(uuid,numeric,boolean)
 to authenticated;
