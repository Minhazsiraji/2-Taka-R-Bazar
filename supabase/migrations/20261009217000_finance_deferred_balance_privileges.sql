-- Security hardening: deferred finance balance assertion must be able to read
-- private journal lines when an authenticated RPC commits. Without SECURITY
-- DEFINER the constraint trigger runs as the end-user and fails with
-- "permission denied for table finance_journal_lines".
-- It is read-only, lives in private (not Data API exposed), uses a fixed schema
-- search_path and has no PUBLIC/anon/authenticated direct EXECUTE grant.
create or replace function private.finance_assert_balanced()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_journal uuid:=coalesce(new.journal_id,old.journal_id);
  v_count integer;
  v_delta numeric;
begin
 select count(*),coalesce(sum(debit-credit),0)
 into v_count,v_delta
 from public.finance_journal_lines where journal_id=v_journal;
 if v_count<2 or v_delta<>0 then
  raise exception 'Unbalanced finance journal %',v_journal;
 end if;
 return null;
end $$;
revoke all on function private.finance_assert_balanced() from public,anon,authenticated;
