-- Independent staff reviewers must be allowed to inspect immutable closed-cycle metadata.
create policy cycle_staff_read on public.simple_sale_cycles for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy member_staff_read on public.simple_sale_cycle_members for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
create policy item_staff_read on public.simple_sale_cycle_items for select to authenticated
 using(private.has_role((select auth.uid()),'admin') or private.has_role((select auth.uid()),'super_admin'));
