// Actual browser -> Server Action -> RPC -> persisted stock/order. Disposable DB only.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID,createHash} from 'node:crypto'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
import {createClient} from '@supabase/supabase-js'
import {createServerClient} from '@supabase/ssr'
const api=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,secret=process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY,proof=process.env.COMMERCE_PREVIEW_SECRET;
if(!/^http:\/\/127\.0\.0\.1:54321\/?$/.test(api??'')||!key||!secret||!proof||process.env.VERCEL_ENV!=='preview')throw new Error('Disposable local Preview required');
const base='http://127.0.0.1:3000',admin=createClient(api,secret,{auth:{persistSession:false,autoRefreshToken:false}}),results=[];
function sql(s){return execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-tAX','-v','ON_ERROR_STOP=1','-c',s],{env:{...process.env,PGPASSWORD:'postgres'},encoding:'utf8'}).trim()}
let actorSequence=6400;
const id=()=>randomUUID(),community=id(),product=id(),lastProduct=id(),point=id();
async function actor(role){const password='Synthetic-'+id()+'Aa1!',email='commerce-'+role+'-'+id()+'@example.invalid';const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(error);const uid=data.user.id;sql(`insert into public.user_roles(user_id,role) values('${uid}','${role}') on conflict do nothing;update public.profiles set full_name='Synthetic commerce ${role}',household_name='Synthetic commerce household',phone='017${String(++actorSequence).padStart(8,'0')}',community_id='${community}',onboarding_completed_at=now() where id='${uid}'`);const jar=new Map();const client=createServerClient(api,key,{cookies:{getAll:()=>[...jar.values()],setAll:cs=>cs.forEach(c=>jar.set(c.name,c))}});const login=await client.auth.signInWithPassword({email,password});assert.ifError(login.error);return {id:uid,client,cookies:()=>[...jar.values()].filter(c=>c.value).map(c=>({name:c.name,value:c.value,url:base,secure:false,sameSite:'Lax'}))}}
async function rpc(a,name,args){const {data,error}=await a.client.rpc(name,args);assert.ifError(error);return data}
async function denied(a,name,args,pattern){const {error}=await a.client.rpc(name,args);assert.ok(error,name+' must be rejected');if(pattern)assert.match(error.message,pattern)}
const p={p_proof:proof};
sql(`update private.commerce_configuration set preview_secret_hash='${createHash('sha256').update(proof).digest('hex')}';insert into public.communities(id,name,slug) values('${community}','Synthetic commerce browser','commerce-browser-${community}');insert into public.pickup_points(id,community_id,name,address) values('${point}','${community}','Synthetic collection point','Synthetic street');insert into public.products(id,name,category,package_size,unit,sku,source_type,is_demo) values('${product}','Synthetic checkout rice','Rice','1 kg','bag','browser-${product}','PRIVATE_LABEL',false),('${lastProduct}','Synthetic last unit','Rice','1 kg','bag','browser-${lastProduct}','PRIVATE_LABEL',false);insert into public.own_product_costs(product_id,purchase_cost) values('${product}',80),('${lastProduct}',80);insert into public.own_product_inventory(product_id,stock_on_hand) values('${product}',10),('${lastProduct}',1) on conflict(product_id) do update set stock_on_hand=excluded.stock_on_hand;`);
const maker=await actor('admin'),reviewer=await actor('super_admin'),a=await actor('customer'),b=await actor('customer');
async function offer(pid,mode='SOLO',poolItem=null,group=null){const sku=sql(`select id from public.commerce_skus where product_id='${pid}'`);const oid=await rpc(maker,'commerce_request_offer',{...p,p_sku:sku,p_community:community,p_mode:mode,p_supplier:null,p_pool_item:poolItem,p_group:group,p_price:100,p_until:new Date(Date.now()+86400000).toISOString(),p_pickup:true,p_delivery:true,p_sla:60});await denied(maker,'commerce_review_offer',{...p,p_id:oid,p_approve:true,p_note:'Maker may not approve its offer'});await rpc(reviewer,'commerce_review_offer',{...p,p_id:oid,p_approve:true,p_note:'Independent synthetic catalog approval'});return oid}
const solo=await offer(product),last=await offer(lastProduct);
const cartArgs=(oid,qty=1)=>({...p,p_guest:null,p_offer:oid,p_quantity:qty});
const quoteArgs={...p,p_guest:null,p_method:'pickup',p_pickup:point,p_address:null};
await Promise.all([rpc(a,'commerce_set_cart_item',cartArgs(last)),rpc(b,'commerce_set_cart_item',cartArgs(last))]);const [qa,qb]=await Promise.all([rpc(a,'commerce_create_quote',quoteArgs),rpc(b,'commerce_create_quote',quoteArgs)]);
const confirm=(quote,key=id())=>({...p,p_quote:quote.id,p_key:key,p_policy:'2026-10-05'});
const raced=await Promise.all([a.client.rpc('commerce_confirm_checkout',confirm(qa)),b.client.rpc('commerce_confirm_checkout',confirm(qb))]);assert.equal(raced.filter(r=>!r.error).length,1);assert.equal(sql(`select reserved_quantity from public.own_product_inventory where product_id='${lastProduct}'`),'1');const winner=raced[0].error?b:a,winningQuote=raced[0].error?qb:qa,order=raced.find(r=>!r.error).data[0];const retries=await Promise.all(Array.from({length:8},()=>rpc(winner,'commerce_confirm_checkout',confirm(winningQuote))));assert.ok(retries.every(ids=>ids[0]===order));assert.equal(sql(`select count(*) from public.commerce_orders where id='${order}'`),'1');results.push('PASS two concurrent buyers compete for one stock unit; eight simultaneous quote retries create one order');
await denied(winner===a?b:a,'commerce_get_order',{p_order:order},/not accessible/);results.push('PASS customer order IDOR');
const cancellation=await rpc(winner,'commerce_request',{...p,p_order:order,p_kind:'cancel',p_reason:'Synthetic concurrent order cancellation'});await rpc(reviewer,'commerce_review_request',{...p,p_request:cancellation,p_approve:true,p_note:'Independent concurrency fixture cancellation'});assert.equal(sql(`select reserved_quantity from public.own_product_inventory where product_id='${lastProduct}'`),'0');results.push('PASS cancellation releases last-unit reservation');
await rpc(a,'commerce_set_cart_item',cartArgs(last,0));await rpc(b,'commerce_set_cart_item',cartArgs(last,0));
await rpc(a,'commerce_set_cart_item',cartArgs(solo));const stale=await rpc(a,'commerce_create_quote',quoteArgs);sql(`update public.commerce_offers set unit_price=110,version=version+1 where id='${solo}'`);await denied(a,'commerce_confirm_checkout',confirm(stale),/Price or offer changed/);await rpc(a,'commerce_set_cart_item',cartArgs(solo,0));results.push('PASS stale server quote rejected without stock movement');
const browser=await chromium.launch({headless:true});await mkdir('artifacts',{recursive:true});const browserErrors=[];
try{
 const context=await browser.newContext({viewport:{width:393,height:900}}),page=await context.newPage();page.on('pageerror',e=>browserErrors.push(e.message));
 await page.goto(base+'/?area='+community,{waitUntil:'networkidle'});const card=page.locator('.market-product-card').filter({hasText:'Synthetic checkout rice'}).first();await card.getByRole('button',{name:'Buy Alone',exact:true}).click();await page.waitForURL('**/cart');assert.equal(await page.getByRole('link',{name:'Synthetic checkout rice',exact:true}).count(),1);const guestCookie=(await context.cookies()).find(c=>c.name==='2tbr_cart');assert.ok(guestCookie?.httpOnly);await page.reload();assert.equal(await page.getByRole('link',{name:'Synthetic checkout rice',exact:true}).count(),1);results.push('PASS guest Add to cart through real Server Action persists an HttpOnly cart across reload');
 await context.addCookies(a.cookies());await page.goto(base+'/cart',{waitUntil:'networkidle'});await page.getByRole('link',{name:'Checkout',exact:true}).click();await page.waitForURL('**/checkout');await page.getByRole('link',{name:'Choose delivery'}).click();await page.locator('select[name="pickup_point_id"]').selectOption(point);await page.getByRole('button',{name:'Review final quote'}).click();await page.waitForURL('**/checkout?quote=*');await page.locator('input[name="policy_accepted"]').check();await page.getByRole('button',{name:'Confirm order'}).click();await page.waitForURL('**/account/orders/*');const purchased=page.url().split('/').at(-1);assert.equal(sql(`select customer_id from public.commerce_orders where id='${purchased}'`),a.id);assert.equal(sql(`select product_subtotal from public.commerce_orders where id='${purchased}'`),'110.00');assert.equal(sql(`select payment_status from public.commerce_orders where id='${purchased}'`),'unpaid');results.push('PASS guest merge -> authenticated three-step checkout -> server-priced persistent COD order -> tracking page');
 for(const width of [360,393,768,1440,1920]){await page.setViewportSize({width,height:900});await page.goto(base+'/account/orders/'+purchased,{waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`artifacts/commerce-order-${width}.png`,fullPage:true})}results.push('PASS order UI at five widths without horizontal overflow');
 await rpc(maker,'commerce_fulfill',{...p,p_order:purchased,p_action:'prepare',p_note:'Synthetic order preparation checked',p_reference:null,p_path:null,p_sha:null,p_delivery_cost:null});await rpc(maker,'commerce_fulfill',{...p,p_order:purchased,p_action:'dispatch',p_note:'Synthetic pickup custody dispatch',p_reference:null,p_path:null,p_sha:null,p_delivery_cost:null});await denied(maker,'commerce_fulfill',{...p,p_order:purchased,p_action:'complete',p_note:'Missing handover evidence denied',p_reference:'QA-MISSING',p_path:null,p_sha:null,p_delivery_cost:0},/evidence required/);
 const original=Buffer.from('%PDF-1.4\nSynthetic commerce handover\n%%EOF'),path=maker.id+'/'+id()+'.pdf',sha=createHash('sha256').update(original).digest('hex');const uploaded=await maker.client.storage.from('commerce-evidence').upload(path,original,{contentType:'application/pdf'});assert.ifError(uploaded.error);await rpc(maker,'commerce_fulfill',{...p,p_order:purchased,p_action:'complete',p_note:'Synthetic physical handover evidence checked',p_reference:'QA-HANDOVER-'+purchased,p_path:path,p_sha:sha,p_delivery_cost:0});await rpc(maker,'commerce_record_cod',{...p,p_order:purchased,p_product:110,p_delivery:0,p_reference:'QA-COD-'+purchased,p_path:path,p_sha:sha});assert.equal(sql(`select payment_status from public.commerce_orders where id='${purchased}'`),'custody_recorded');assert.equal(sql(`select count(*) from public.finance_customer_events where source_id='${purchased}'`),'0');results.push('PASS physical stock consumption, evidence requirement and COD custody do not auto-post Finance');
 await page.reload();assert.equal(await page.getByText('Status: completed',{exact:false}).count(),1);await page.locator('select[name="kind"]').selectOption('return');await page.locator('textarea[name="reason"]').fill('Synthetic received product return request');await page.getByRole('button',{name:'Submit request'}).click();await page.getByText('Synthetic received product return request',{exact:false}).waitFor();const request=sql(`select id from public.commerce_requests where order_id='${purchased}' and kind='return'`);await rpc(reviewer,'commerce_review_request',{...p,p_request:request,p_approve:true,p_note:'Independent synthetic return approval'});const line=sql(`select id from public.commerce_order_items where order_id='${purchased}'`);await rpc(maker,'commerce_receive_return',{...p,p_request:request,p_lines:[{line_id:line,quantity:1}],p_restock:true,p_path:path,p_sha:sha});assert.equal(sql(`select stock_on_hand from public.own_product_inventory where product_id='${product}'`),'9');results.push('PASS browser return request -> independent approval -> physical receipt; no premature restock or refund');

 // Actual Pool and Group commitments must await final terms and explicit checkout.
 async function browserCheckout(expectedMode){
  await page.goto(base+'/cart',{waitUntil:'networkidle'});
  await page.getByRole('link',{name:'Checkout',exact:true}).click();
  await page.getByRole('link',{name:'Choose delivery',exact:true}).click();
  await page.locator('select[name="pickup_point_id"]').selectOption(point);
  await page.getByRole('button',{name:'Review final quote',exact:true}).click();
  await page.waitForURL('**/checkout?quote=*');
  await page.locator('input[name="policy_accepted"]').check();
  await page.getByRole('button',{name:'Confirm order',exact:true}).click();
  await page.waitForURL('**/account/orders/*');
  const oid=page.url().split('/').at(-1);
  assert.equal(sql(`select mode from public.commerce_orders where id='${oid}'`),expectedMode);
  return oid;
 }
 const pool=id(),poolItem=id();
 sql(`insert into public.pools(id,community_id,title,status,cadence,opens_at,commitment_closes_at,confirmation_closes_at,pickup_at) values('${pool}','${community}','Synthetic browser Pool','open','weekly',now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',now()+interval '3 days');insert into public.pool_items(id,pool_id,product_id,benchmark_price_snapshot,expected_pool_price) values('${poolItem}','${pool}','${product}',120,100);`);
 const poolOffer=await offer(product,'POOL',poolItem);
 sql(`insert into public.community_qr_codes(code,community_id,campaign_name) values('QA-COMMERCE-64','${community}','Synthetic browser QR');`);
 await page.goto(base+'/community-invite/QA-COMMERCE-64',{waitUntil:'networkidle'});
 await page.getByRole('link',{name:'Browse community offers without signing in →'}).click();
 await page.waitForURL(url=>url.searchParams.get('area')===community);
 assert.equal(new URL(page.url()).searchParams.get('area'),community);
 results.push('PASS QR community attribution preserved through browse-first landing');
 await page.goto(base+'/pool',{waitUntil:'networkidle'});
 await page.locator(`form:has(input[name="pool_item_id"][value="${poolItem}"])`).filter({has:page.locator('input[name="quantity"]')}).getByRole('button').click();
 await page.waitForURL('**/cart');
 assert.equal(sql(`select state from public.commerce_cart_items where offer_id='${poolOffer}' and cart_id=(select id from public.commerce_carts where customer_id='${a.id}')`),'waiting');
 await denied(a,'commerce_create_quote',quoteArgs,/No payable items/);
 sql(`update public.pool_items set final_customer_price=95 where id='${poolItem}';update public.pools set status='confirmation',commitment_closes_at=now()-interval '1 minute' where id='${pool}';`);
 const poolOrder=await browserCheckout('POOL');
 assert.equal(sql(`select product_subtotal from public.commerce_orders where id='${poolOrder}'`),'95.00');
 assert.equal(sql(`select count(*) from public.notifications where user_id='${a.id}' and title='Price unlocked'`),'1');
 results.push('PASS browser Pool join -> waiting with no charge -> price lock notification -> explicit pickup checkout');
 // Full staff forms exercise Server Actions, evidence uploads and scoped RPCs.
 const staffContext=await browser.newContext();await staffContext.addCookies(maker.cookies());const staffPage=await staffContext.newPage();
 for(const operation of ['prepare','dispatch','complete']){
  await staffPage.goto(base+'/commerce',{waitUntil:'networkidle'});
  const orderCard=staffPage.locator('article').filter({has:staffPage.locator(`a[href="/account/orders/${poolOrder}"]`)});
  const form=orderCard.locator('form').first();await form.locator('textarea[name="reason"]').fill('Synthetic browser staff '+operation+' checked');
  if(operation==='complete'){
   await form.locator('input[name="reference"]').fill('QA-BROWSER-POOL');
   await form.locator('input[name="evidence"]').setInputFiles({name:'handover.pdf',mimeType:'application/pdf',buffer:original});
  }
  await form.getByRole('button',{name:'Record operation',exact:true}).click();
  const expectedStatus=operation==='prepare'?'preparing':operation==='dispatch'?'ready_for_pickup':'completed';
  await orderCard.getByText('POOL · '+expectedStatus+' · unpaid',{exact:true}).waitFor();
  assert.equal(sql(`select status from public.commerce_orders where id='${poolOrder}'`),operation==='prepare'?'preparing':operation==='dispatch'?'ready_for_pickup':'completed');
 }
 await staffContext.close();
 results.push('PASS staff browser preparation -> dispatch -> original evidence upload -> Pool pickup handover');
 // Five genuine synthetic actors qualify through the actual location/join functions.
 const group=id(),groupBuyers=[a,b,await actor('customer'),await actor('customer'),await actor('customer')];
 sql(`update public.communities set center_latitude=23.8103,center_longitude=90.4125,location_matching_enabled=true where id='${community}';insert into public.group_deals(id,product_id,title,status,market_price_snapshot,opens_at,closes_at,pickup_at,min_group_size,circle_capacity) values('${group}','${product}','Synthetic browser Group','open',120,now()-interval '1 day',now()+interval '1 day',now()+interval '2 days',5,5);insert into public.group_deal_communities(group_deal_id,community_id) values('${group}','${community}');insert into public.group_deal_tiers(group_deal_id,buyer_threshold,customer_unit_price) values('${group}',5,90);`);
 const groupOffer=await offer(product,'GROUP_DEAL',null,group);
 for(const buyer of groupBuyers)await rpc(buyer,'verify_my_community_location',{p_latitude:23.8103,p_longitude:90.4125,p_accuracy_m:10});
 await page.goto(base+'/group-deals',{waitUntil:'networkidle'});
 await page.locator(`form:has(input[name="group_deal_id"][value="${group}"])`).filter({has:page.locator('input[name="quantity"]')}).getByRole('button',{name:'Join group',exact:true}).click();await page.waitForURL('**/cart');
 await denied(a,'commerce_create_quote',quoteArgs,/No payable items/);
 for(const buyer of groupBuyers.slice(1))await rpc(buyer,'commerce_set_cart_item',cartArgs(groupOffer));
 assert.equal(sql(`select count(*) from public.group_deal_commitments where group_deal_id='${group}' and status='qualified'`),'5');
 sql(`update public.group_deals set closes_at=now()-interval '1 minute' where id='${group}'`);
 await rpc(maker,'admin_set_group_deal_status',{p_group_deal_id:group,p_status:'locked',p_reason:'Synthetic browser advertised close and real qualification checked'});
 const groupOrder=await browserCheckout('GROUP_DEAL');
 assert.equal(sql(`select product_subtotal from public.commerce_orders where id='${groupOrder}'`),'90.00');
 for(const action of ['prepare','dispatch','complete'])await rpc(maker,'commerce_fulfill',{...p,p_order:groupOrder,p_action:action,p_note:'Synthetic qualified Group '+action+' checked',p_reference:'QA-GROUP-HANDOVER',p_path:path,p_sha:sha,p_delivery_cost:0});
 assert.equal(sql(`select status from public.group_deal_commitments where group_deal_id='${group}' and customer_id='${a.id}'`),'fulfilled');
 await page.reload();assert.equal(await page.getByText('Status: completed',{exact:false}).count(),1);
 results.push('PASS browser Group join -> five independently located buyers -> actual locked tier -> explicit checkout -> Group fulfillment');
 assert.deepEqual(browserErrors,[]);await context.close();
}finally{await browser.close();await writeFile('artifacts/commerce-test-report.txt',results.join('\n')+'\n');console.log(results.join('\n'))}
