-- Read-only inventory of application schema. No user rows or secret values.
with objects as (
 select 'function' as kind, p.oid::regprocedure::text as name, pg_get_functiondef(p.oid) as definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'
 union all
 select 'column', table_schema||'.'||table_name||'.'||column_name,
 concat_ws('|',ordinal_position,data_type,udt_name,is_nullable,column_default)
 from information_schema.columns where table_schema in ('public','private')
 union all
 select 'constraint', c.conrelid::regclass::text||'.'||c.conname, pg_get_constraintdef(c.oid)
 from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','private')
 union all
 select 'index', schemaname||'.'||indexname,indexdef from pg_indexes where schemaname in ('public','private')
 union all
 select 'policy',schemaname||'.'||tablename||'.'||policyname, concat_ws('|',permissive,roles::text,cmd,qual,with_check)
 from pg_policies where schemaname in ('public','private') or schemaname='storage'
 union all
 select 'rls', n.nspname||'.'||c.relname, concat_ws('|',c.relrowsecurity,c.relforcerowsecurity)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'
 union all
 select 'view',n.nspname||'.'||c.relname,pg_get_viewdef(c.oid,true)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='v'
 union all
 select 'enum',n.nspname||'.'||t.typname,string_agg(e.enumlabel,'|' order by e.enumsortorder)
 from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname in ('public','private') group by n.nspname,t.typname
 union all
 select 'trigger',c.oid::regclass::text||'.'||t.tgname,pg_get_triggerdef(t.oid,true)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and not t.tgisinternal
 union all
 select 'table_acl',n.nspname||'.'||c.relname,c.relacl::text
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','v')
 union all
 select 'function_acl',p.oid::regprocedure::text,p.proacl::text
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'
 union all
 select 'schema_acl',nspname,nspacl::text from pg_namespace where nspname in ('public','private')
 union all
 select 'bucket',id,concat_ws('|',public,file_size_limit,allowed_mime_types::text) from storage.buckets where id='record-photos'
 union all
 select 'relation_options' as kind,n.nspname||'.'||c.relname as name,concat_ws('|',pg_get_userbyid(c.relowner),c.reloptions::text) as definition from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind in ('r','v') union all select 'function_owner',p.oid::regprocedure::text,pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' union all select 'storage_trigger',t.tgname,pg_get_triggerdef(t.oid,true) from pg_trigger t where t.tgrelid='storage.objects'::regclass and t.tgname='guard_account_upload'
)
select kind,name,md5(definition) as fingerprint from objects order by kind,name;
