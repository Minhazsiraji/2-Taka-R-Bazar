-- Align hot-path indexes and RLS evaluation for lower latency at scale.
-- This migration is intentionally additive / semantic-preserving.

create index if not exists orders_pool_id_idx on public.orders (pool_id);
create index if not exists order_items_pool_item_id_idx on public.order_items (pool_item_id);
create index if not exists order_items_product_id_idx on public.order_items (product_id);
create index if not exists pool_items_product_id_idx on public.pool_items (product_id);
create index if not exists supplier_quotes_supplier_id_idx on public.supplier_quotes (supplier_id);
create index if not exists market_price_observations_community_product_observed_idx on public.market_price_observations (community_id, product_id, observed_on desc);
create index if not exists notifications_pool_id_idx on public.notifications (pool_id) where pool_id is not null;
create index if not exists notifications_order_id_idx on public.notifications (order_id) where order_id is not null;
create index if not exists pickup_points_community_id_idx on public.pickup_points (community_id);
create index if not exists pool_pickup_points_pickup_point_id_idx on public.pool_pickup_points (pickup_point_id);
create index if not exists payment_records_order_id_idx on public.payment_records (order_id);
create index if not exists savings_ledger_order_id_idx on public.savings_ledger (order_id);
create index if not exists own_product_inventory_movements_order_item_id_idx on public.own_product_inventory_movements (order_item_id) where order_item_id is not null;
create index if not exists own_product_inventory_movements_actor_user_id_idx on public.own_product_inventory_movements (actor_user_id) where actor_user_id is not null;

alter policy pool_loves_insert on public.pool_loves
  with check ((user_id = (select auth.uid())) and private.can_engage_pool(pool_id));
alter policy pool_loves_delete on public.pool_loves
  using (user_id = (select auth.uid()));
alter policy pool_item_loves_insert on public.pool_item_loves
  with check ((user_id = (select auth.uid())) and private.can_engage_pool_item(pool_item_id));
alter policy pool_item_loves_delete on public.pool_item_loves
  using (user_id = (select auth.uid()));
alter policy pool_reviews_insert on public.pool_reviews
  with check ((user_id = (select auth.uid())) and private.can_review_pool(pool_id));
alter policy pool_reviews_update on public.pool_reviews
  using (user_id = (select auth.uid()))
  with check ((user_id = (select auth.uid())) and private.can_review_pool(pool_id));
alter policy pool_item_reviews_insert on public.pool_item_reviews
  with check ((user_id = (select auth.uid())) and private.can_review_pool_item(pool_item_id));
alter policy pool_item_reviews_update on public.pool_item_reviews
  using (user_id = (select auth.uid()))
  with check ((user_id = (select auth.uid())) and private.can_review_pool_item(pool_item_id));
alter policy notifications_select_own on public.notifications
  using ((select auth.uid()) = user_id);
alter policy subscription_membership_read on public.subscription_memberships
  using ((user_id = (select auth.uid())) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy subscription_coupon_admin_read on public.subscription_coupons
  using (private.has_role((select auth.uid()), 'super_admin'::text));
alter policy subscription_redemption_read on public.subscription_coupon_redemptions
  using ((user_id = (select auth.uid())) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy subscription_invoice_read on public.subscription_invoices
  using ((customer_id = (select auth.uid())) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy supplier_receipts_admin_read on public.supplier_receipts
  using (
    private.has_role((select auth.uid()), 'admin'::text)
    or private.has_role((select auth.uid()), 'super_admin'::text)
    or exists (
      select 1 from public.pool_items pi
      join public.pools po on po.id = pi.pool_id
      where pi.id = supplier_receipts.pool_item_id
        and po.receiving_pickup_point_id is not null
        and private.is_assigned_pickup((select auth.uid()), po.receiving_pickup_point_id)
    )
  );
alter policy referrals_admin_read on public.referrals
  using (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy coin_ledger_own_read on public.coin_ledger
  using (user_id = (select auth.uid()) or private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy own_product_costs_admin on public.own_product_costs
  using (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text))
  with check (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy own_product_inventory_admin on public.own_product_inventory
  using (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text))
  with check (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy own_product_inventory_movements_admin on public.own_product_inventory_movements
  using (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy own_product_price_tiers_admin on public.own_product_price_tiers
  using (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text))
  with check (private.has_role((select auth.uid()), 'admin'::text) or private.has_role((select auth.uid()), 'super_admin'::text));
alter policy own_product_price_tiers_customer_read on public.own_product_price_tiers
  using (
    exists (
      select 1 from public.pool_items pi
      join public.pools po on po.id = pi.pool_id
      join public.profiles p on p.id = (select auth.uid())
      where pi.id = own_product_price_tiers.pool_item_id
        and pi.active
        and po.community_id = p.community_id
        and po.status <> all (array['draft'::text, 'cancelled'::text])
    )
  );
