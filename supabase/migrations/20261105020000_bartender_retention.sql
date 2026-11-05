-- Chat receipts duplicate bounded history; retain them only for 24-hour retry recovery.
create index bartender_turns_started_idx on private.bartender_turns(started_at);
create function private.prune_bartender_receipts() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from private.bartender_turns where started_at<clock_timestamp()-interval '24 hours';
 delete from private.bartender_daily where day<(clock_timestamp() at time zone 'UTC')::date-30;
 return new;
end;$$;
create trigger bartender_receipt_retention before insert on private.bartender_turns for each statement execute function private.prune_bartender_receipts();
create function private.erase_bartender_daily() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from private.bartender_daily where bucket=old.id::text;
 return old;
end;$$;
create trigger bartender_daily_owner_delete after delete on auth.users for each row execute function private.erase_bartender_daily();
revoke all on function private.prune_bartender_receipts(),private.erase_bartender_daily() from public,anon,authenticated;
