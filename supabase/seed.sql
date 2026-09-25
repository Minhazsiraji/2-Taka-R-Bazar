-- Safe Step-1 demo seed. Prices are intentionally NOT seeded as business truth.
insert into public.communities(name,slug,sort_order) values
  ('Amin Model Town','amin-model-town',1),
  ('Savar DOHS','savar-dohs',2),
  ('Pollibiddut / Nabinagar','pollibiddut-nabinagar',3)
on conflict(slug) do update set name=excluded.name, sort_order=excluded.sort_order, active=true;

insert into public.products(name,brand,category,package_size,unit,sku,is_demo) values
  ('Demo Detergent','Sample Brand','Laundry','1 kg','pack','DEMO-DETERGENT-1KG',true),
  ('Demo Facial Tissue','Sample Brand','Household','120 sheets','box','DEMO-TISSUE-120',true),
  ('Demo Dishwashing Liquid','Sample Brand','Household','500 ml','bottle','DEMO-DISH-500ML',true),
  ('Demo Soybean Oil','Sample Brand','Grocery','2 litre','bottle','DEMO-OIL-2L',true),
  ('Demo Lentil','Sample Brand','Grocery','1 kg','pack','DEMO-LENTIL-1KG',true)
on conflict(sku) do update set active=true, is_demo=true;
