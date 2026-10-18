-- Staff may supply a pickup point, scheduled time or delivery instructions
-- after confirming a pilot booking. Service-note-only; no Commerce/Finance write.
create function public.pilot_staff_send_service_update(
 p_booking_id uuid,p_customer_message text
) returns text language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid();
 v public.pilot_booking_requests%rowtype;
 v_note text:=btrim(coalesce(p_customer_message,''));
 v_event_id bigint;
begin
 if v_user is null or not (
  private.has_role(v_user,'admin') or private.has_role(v_user,'super_admin')
 ) then
  raise exception using errcode='42501',message='Admin access required';
 end if;
 if char_length(v_note)<5 or char_length(v_note)>500 then
  raise exception 'Enter a customer update between 5 and 500 characters';
 end if;
 select * into v from public.pilot_booking_requests
 where id=p_booking_id for update;
 if v.id is null then raise exception 'Booking not found';end if;
 if v.status<>'confirmed' then
  raise exception 'Only confirmed bookings can receive service updates';
 end if;
 if v.staff_note=v_note then raise exception 'The customer already has this update';end if;
 if (select count(*) from public.pilot_booking_events
     where booking_id=v.id and from_status='confirmed' and to_status='confirmed'
     and created_at>now()-interval '24 hours')>=10
 then raise exception 'Daily service update limit reached';end if;
 update public.pilot_booking_requests set
  staff_note=v_note,updated_at=now(),last_action_by=v_user
 where id=v.id;
 insert into public.pilot_booking_events(booking_id,actor_user_id,from_status,to_status,note)
 values(v.id,v_user,'confirmed','confirmed',v_note)
 returning id into v_event_id;
 insert into public.notifications(user_id,kind,title,body,href,priority,dedupe_key)
 values(v.customer_id,'pilot_booking','Pickup or delivery instructions updated',
  '2TBR has updated the arrangements for '||v.product_name||'. Open My bookings to see the details.',
  '/pilot-bookings','normal','pilot:service:'||v.id::text||':'||v_event_id::text)
 on conflict(user_id,dedupe_key) do nothing;
 return 'updated';
end $$;

revoke all on function public.pilot_staff_send_service_update(uuid,text)
 from public,anon,service_role;
grant execute on function public.pilot_staff_send_service_update(uuid,text)
 to authenticated;
