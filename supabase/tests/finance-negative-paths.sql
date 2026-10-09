-- Finance QA negative paths & exceptional states (synthetic only, fully rolled back).
begin;
create extension if not exists pgtap with schema extensions;

create or replace function pg_temp.fails_with(p_statement text,p_state text default null,p_fragment text default null)
returns boolean language plpgsql as $fn$
begin
 execute p_statement;
 return false;
exception when others then
 return (p_state is null or sqlstate=p_state) and
        (p_fragment is null or position(p_fragment in sqlerrm)>0);
end $fn$;

insert into auth.users(id,instance_id,aud,role,email,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000911','00000000-0000-0000-0000-000000000000','authenticated','authenticated','synthetic-maker-qa@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000912','00000000-0000-0000-0000-000000000000','authenticated','authenticated','synthetic-checker-qa@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000913','00000000-0000-0000-0000-000000000000','authenticated','authenticated','synthetic-customer-qa@example.invalid',now(),now()),
 ('00000000-0000-4000-8000-000000000914','00000000-0000-0000-0000-000000000000','authenticated','authenticated','synthetic-admin-qa@example.invalid',now(),now());

insert into public.user_roles(user_id,role)
values ('00000000-0000-4000-8000-000000000911','admin'),
 ('00000000-0000-4000-8000-000000000912','super_admin'),
 ('00000000-0000-4000-8000-000000000914','admin');

insert into storage.objects(bucket_id,name)
values
 ('finance-evidence','00000000-0000-4000-8000-000000000911/r1.jpg'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/r2.jpg'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/r3.jpg'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/r4.jpg'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/r5.jpg'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/r6.jpg'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/transfer1.pdf'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/transfer2.pdf'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/transfer3.pdf'),
 ('finance-evidence','00000000-0000-4000-8000-000000000911/transfer4.pdf');
create temporary table qa_expenses(label text primary key,id uuid not null);
create temporary table qa_settlements(label text primary key,id uuid not null);

select plan(38);

-- Credential/authorization attack paths.
select ok(not has_table_privilege('authenticated','public.finance_expenses','INSERT'),'Authenticated users have no direct expense INSERT privilege');
select ok(not has_table_privilege('authenticated','public.finance_journals','UPDATE'),'No direct journal UPDATE privilege');
select ok(not has_table_privilege('anon','public.finance_expenses','SELECT'),'Anonymous clients cannot read finance');
select ok((select relrowsecurity from pg_class where oid='public.finance_settlement_requests'::regclass),'Settlement RLS enforced');
select ok((select relrowsecurity from pg_class where oid='public.finance_accounts'::regclass),'Chart of accounts RLS enforced');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000913',true);
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_online','Fake ads expense','Fake vendor','ANON-001',400,current_date,
 '00000000-0000-4000-8000-000000000911/r1.jpg',$sha$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$sha$,null,null)$$,
 'P0001','Finance staff role required'),'Customer cannot submit business expenses');
select ok(pg_temp.fails_with(
 $$select public.finance_report(current_date)$$,
 'P0001','Super Admin role required'),'Customer cannot retrieve finance reports');
select ok(pg_temp.fails_with(
 $$select public.finance_ledger(current_date)$$,
 'P0001','Super Admin role required'),'Customer cannot retrieve general ledger');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000911',true);
-- Bad input, fraud and evidence tampering cases.
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_offline','Fake QR campaign','Test printer','R1',0,current_date,
 '00000000-0000-4000-8000-000000000911/r1.jpg',repeat('a',64),null,null)$$,
 'P0001','Expense amount must be'),'Zero expense rejected');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_offline','Fake QR campaign','Test printer','R2',1.999,current_date,
 '00000000-0000-4000-8000-000000000911/r1.jpg',repeat('a',64),null,null)$$,
 'P0001','no more than two decimal places'),'Sub-taka precision cannot be rounded silently');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_offline','Fake QR campaign','Test printer','R3',100,current_date+1,
 '00000000-0000-4000-8000-000000000911/r1.jpg',repeat('a',64),null,null)$$,
 'P0001','Expense date cannot be in the future'),'Future expenses rejected');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('invalid_category','Fake QR campaign','Test printer','R4',100,current_date,
 '00000000-0000-4000-8000-000000000911/r1.jpg',repeat('a',64),null,null)$$,
 'P0001','Invalid expense category'),'Unrecognized expense categories rejected');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_offline','Fake QR campaign','Test printer','R5',100,current_date,
 '00000000-0000-4000-8000-000000000912/r1.jpg',repeat('a',64),null,null)$$,
 'P0001','Uploaded receipt'),'Cross-user receipt paths cannot be used');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_offline','Fake QR campaign','Test printer','R6',100,current_date,
 '00000000-0000-4000-8000-000000000911/not-uploaded.jpg',repeat('a',64),null,null)$$,
 'P0001','Uploaded receipt'),'Invoice metadata without uploaded source document rejected');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_offline','Fake QR campaign','Test printer','R7',100,current_date,
 '00000000-0000-4000-8000-000000000911/r1.jpg','not-a-sha',null,null)$$,
 'P0001','Uploaded receipt'),'Malformed SHA fingerprint rejected');

insert into qa_expenses(label,id) select 'one',public.finance_submit_expense('marketing_offline',
 'QR poster print for building 1','QA printer','QR-INV-01',1250,current_date,
 '00000000-0000-4000-8000-000000000911/r1.jpg',repeat('a',64),null,'AMT-01');
select is((select count(*)::integer from public.finance_expenses where document_reference='QR-INV-01'),1,'Authentic synthetic QR invoice recorded exactly once');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_offline','QR poster print for building 1',' qa PRINTER ',' qr-inv-01 ',1250,current_date,
 '00000000-0000-4000-8000-000000000911/r2.jpg',repeat('b',64),null,'AMT-01')$$,
 '23505','finance_expenses_vendor_document_unique'),'Case/space variant of existing vendor invoice blocked');
select ok(pg_temp.fails_with(
 $$select public.finance_submit_expense('marketing_online','Fake alternate vendor','Another merchant','NEW-DOC-02',1250,current_date,
 '00000000-0000-4000-8000-000000000911/r2.jpg',repeat('a',64),null,'AMT-01')$$,
 '23505','finance_expense_evidence_once'),'Reused receipt content under new vendor/reference blocked');

-- Rejected expenses leave a trace, but corrected resubmission with new receipt is allowed.
insert into qa_expenses(label,id) select 'rejected',public.finance_submit_expense('logistics',
 'Rejectable expense for correction','QA transport','TR-REVISE-01',450,current_date,
 '00000000-0000-4000-8000-000000000911/r2.jpg',repeat('b',64),null,null);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000912',true);
select ok(pg_temp.fails_with(
 format('select public.finance_review_expense(%L::uuid,false,%L)',(select id from qa_expenses where label='rejected'),''),
 'P0001','Rejection reason required'),'Rejecting an expense requires a documented explanation');
select is(public.finance_review_expense((select id from qa_expenses where label='rejected'),false,'Wrong invoice value'),
 'rejected','Reviewer can reject without posting a ledger journal');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000911',true);
insert into qa_expenses(label,id) select 'corrected',public.finance_submit_expense('logistics',
 'Corrected invoice after rejection','QA transport','TR-REVISE-01',400,current_date,
 '00000000-0000-4000-8000-000000000911/r3.jpg',repeat('c',64),null,null);
select is((select count(*)::integer from public.finance_expenses where document_reference='TR-REVISE-01'),2,
 'Correction preserves original rejection and new submission');

-- High value authorization and blocked dual-approval path.
insert into qa_expenses(label,id) select 'high',public.finance_submit_expense('office',
 'Equipment and office operating cost','QA office','OFFICE-APPROVAL',6000,current_date,
 '00000000-0000-4000-8000-000000000911/r4.jpg',repeat('d',64),null,null);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000914',true);
select ok(pg_temp.fails_with(
 format('select public.finance_review_expense(%L::uuid,true,%L)',(select id from qa_expenses where label='high'),'Checked'),
 'P0001','Large expense requires owner review'),'Ordinary admin cannot approve above BDT 5000');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000912',true);
select is(public.finance_review_expense((select id from qa_expenses where label='high'),true,'Approved by owner'),
 'posted','Owner review posts a BDT 6000 expense');
select is(public.finance_review_expense((select id from qa_expenses where label='corrected'),true,'Corrected evidence inspected'),
 'posted','Corrected expense posts normally');
select is(public.finance_review_expense((select id from qa_expenses where label='one'),true,'Printed posters verified'),
 'posted','Original marketing expense posts normally');
select ok(pg_temp.fails_with(
 format('select public.finance_review_expense(%L::uuid,true,%L)',(select id from qa_expenses where label='one'),'Replay'),
 'P0001','Only submitted expense can be reviewed'),'Repeated approval cannot duplicate expense recognition');

-- Ledger assertions independent of API calculations.
select is((select sum(debit-credit) from public.finance_journal_lines),0::numeric,'Across all approved expenses journal debits balance credits');
select is((select sum(l.debit) from public.finance_journal_lines l join public.finance_accounts a on a.code=l.account_code where a.kind='expense'),
 7650::numeric,'Exact posted operating expenses equal 1250+400+6000');
select is((select (public.finance_report(current_date)->>'posted_expenses')::numeric),7650::numeric,'Dashboard report equals journal');
select is((select count(*)::integer from public.finance_journals where source_type='expense_accrual'),3,'Rejected expenses never create journals');
select ok(pg_temp.fails_with(
 format('update public.finance_journals set memo=%L where source_id=%L::uuid','tampered',(select id from qa_expenses where label='one')),
 'P0001','Posted finance journals are immutable'),'Posted financial records cannot be silently edited');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000911',true);
insert into qa_settlements(label,id)
select 'rejected',public.finance_request_settlement(
 (select id from qa_expenses where label='one'),'bank','QA-BANK-TRANSFER-01',current_date,
 '00000000-0000-4000-8000-000000000911/transfer1.pdf',repeat('e',64));
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000912',true);
select is(public.finance_review_settlement((select id from qa_settlements where label='rejected'),false,'Proof mismatched bank transfer'),
 'rejected','Bank payment proof can be rejected without disbursement posting');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000911',true);
insert into qa_settlements(label,id)
select 'paid',public.finance_request_settlement(
 (select id from qa_expenses where label='one'),'bank','QA-BANK-TRANSFER-02',current_date,
 '00000000-0000-4000-8000-000000000911/transfer2.pdf',repeat('f',64));
select is((select count(*)::integer from public.finance_settlement_requests where expense_id=(select id from qa_expenses where label='one')),
 2,'Rejected payment retry preserves both attempts');
select ok(pg_temp.fails_with(
 $$select public.finance_request_settlement((select id from qa_expenses where label='corrected'),
 'bank','QA-BANK-TRANSFER-02',current_date,
 '00000000-0000-4000-8000-000000000911/transfer3.pdf',repeat('1',64))$$,
 '23505','finance_settlement_reference_live'),'Reused bank transfer reference blocked across different approved expenses');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000912',true);
select is(public.finance_review_settlement((select id from qa_settlements where label='paid'),true,'Matched independent proof'),
 'verified','Independent final settlement verification posts cash movement');
select is((select (public.finance_report(current_date)->>'settled_cash_out')::numeric),1250::numeric,
 'Monthly outgoing cash equals the sole internally verified payment');
select is((select sum(debit-credit) from public.finance_journal_lines),0::numeric,
 'Ledger is still globally balanced after payment and reversal attempts');
select is((select count(*)::integer from public.finance_journals where source_type='expense_settlement'),1,
 'Rejected payment never posts, approved one posts exactly once');

select * from finish();
rollback;
