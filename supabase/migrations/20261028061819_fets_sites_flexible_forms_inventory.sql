-- FETS Live: configurable optional questions and a quantity inventory. No stock,
-- client approval, room or staff records are seeded or deleted.
create function ascender_private.builtin_question(p_section text,p_key text) returns boolean
language sql immutable security invoker set search_path='' as $$select coalesce(('{"ascender_centres": ["address", "map_url", "contact_phone", "contact_email", "manager_id", "backup_id", "operating_hours", "hours_effective_from", "notes"], "ascender_rooms": ["name", "total_seats", "unavailable_seats", "accessibility", "notes"], "ascender_programmes": ["client_id", "programme", "site_code", "approved_capacity", "approval", "evidence_url", "notes"], "ascender_documents": ["title", "url", "owner_id", "compliance_id", "notes"], "compliance_items": ["title", "category", "owner_profile_id", "next_due", "lead_days", "frequency", "notes"], "ascender_deployments": ["venue", "address", "contact", "client_id", "programme", "start_date", "end_date", "setup_due", "required_seats", "lead_id", "transport_notes", "status", "readiness", "readiness_note", "closeout_notes"], "ascender_inventory": ["name", "category", "quantity", "unit", "location", "notes"]}'::jsonb->p_section)?p_key,false)$$;
revoke all on function ascender_private.builtin_question(text,text) from public,anon;
grant execute on function ascender_private.builtin_question(text,text) to authenticated;
create table public.ascender_inventory(
 id uuid primary key default gen_random_uuid(),centre_id uuid not null references public.ascender_centres(id),
 name text check(length(btrim(name)) between 1 and 160),category text,quantity integer check(quantity between 0 and 1000000),
 unit text,location text,notes text,archived boolean not null default false,
 version integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),
 custom_answers jsonb not null default '{}' check(jsonb_typeof(custom_answers)='object' and octet_length(custom_answers::text)<=100000)
);
create index ascender_inventory_centre on public.ascender_inventory(centre_id);
create unique index ascender_inventory_active_item on public.ascender_inventory(centre_id,lower(btrim(name)),lower(btrim(coalesce(category,''))),lower(btrim(coalesce(location,'')))) where not archived and name is not null;
create index ascender_inventory_actor on public.ascender_inventory(updated_by);
create table public.ascender_fields(
 id uuid primary key default gen_random_uuid(),centre_id uuid not null references public.ascender_centres(id),
 section text not null check(section in ('ascender_centres','ascender_rooms','ascender_programmes','ascender_documents','compliance_items','ascender_deployments','ascender_inventory')),
 field_key text not null,label text not null check(length(btrim(label)) between 1 and 160),
 kind text not null check(kind in ('builtin','text','textarea','number','date','url','email','checkbox','choice')),
 options jsonb not null default '[]' check(jsonb_typeof(options)='array' and jsonb_array_length(options)<=40),
 removed boolean not null default false,
 version integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),
 unique(centre_id,section,field_key)
);
create index ascender_fields_actor on public.ascender_fields(updated_by);
alter table public.ascender_centres
 alter column address drop not null,
 alter column map_url drop not null,
 alter column contact_phone drop not null,
 alter column contact_email drop not null,
 alter column manager_id drop not null,
 alter column backup_id drop not null,
 alter column operating_hours drop not null,
 alter column hours_effective_from drop not null,
 alter column notes drop not null;
alter table public.ascender_centres add column custom_answers jsonb not null default '{}' check(jsonb_typeof(custom_answers)='object' and octet_length(custom_answers::text)<=100000);
alter table public.ascender_rooms
 alter column name drop not null,
 alter column total_seats drop not null,
 alter column unavailable_seats drop not null,
 alter column accessibility drop not null,
 alter column notes drop not null;
alter table public.ascender_rooms add column custom_answers jsonb not null default '{}' check(jsonb_typeof(custom_answers)='object' and octet_length(custom_answers::text)<=100000);
alter table public.ascender_programmes
 alter column client_id drop not null,
 alter column programme drop not null,
 alter column site_code drop not null,
 alter column approved_capacity drop not null,
 alter column approval drop not null,
 alter column evidence_url drop not null,
 alter column notes drop not null;
alter table public.ascender_programmes add column custom_answers jsonb not null default '{}' check(jsonb_typeof(custom_answers)='object' and octet_length(custom_answers::text)<=100000);
alter table public.ascender_documents
 alter column title drop not null,
 alter column url drop not null,
 alter column owner_id drop not null,
 alter column compliance_id drop not null,
 alter column notes drop not null;
alter table public.ascender_documents add column custom_answers jsonb not null default '{}' check(jsonb_typeof(custom_answers)='object' and octet_length(custom_answers::text)<=100000);
alter table public.compliance_items
 alter column title drop not null,
 alter column category drop not null,
 alter column owner_profile_id drop not null,
 alter column next_due drop not null,
 alter column lead_days drop not null,
 alter column frequency drop not null,
 alter column notes drop not null;
alter table public.compliance_items add column custom_answers jsonb not null default '{}' check(jsonb_typeof(custom_answers)='object' and octet_length(custom_answers::text)<=100000);
alter table public.ascender_deployments
 alter column venue drop not null,
 alter column address drop not null,
 alter column contact drop not null,
 alter column client_id drop not null,
 alter column programme drop not null,
 alter column start_date drop not null,
 alter column end_date drop not null,
 alter column setup_due drop not null,
 alter column required_seats drop not null,
 alter column lead_id drop not null,
 alter column transport_notes drop not null,
 alter column status drop not null,
 alter column readiness drop not null,
 alter column readiness_note drop not null,
 alter column closeout_notes drop not null;
alter table public.ascender_deployments add column custom_answers jsonb not null default '{}' check(jsonb_typeof(custom_answers)='object' and octet_length(custom_answers::text)<=100000);
-- These were product-form requirements, not programme-owner rules. Staff record
-- an approval/readiness declaration; this register never grants exam authority.
alter table public.ascender_programmes drop constraint ascender_programmes_check;
alter table public.ascender_deployments drop constraint ascender_deployments_check2,drop constraint ascender_deployments_check3;
alter table public.ascender_rooms alter column unavailable_seats drop default;
create function ascender_private.field_definition_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.kind='builtin' then
  if not ascender_private.builtin_question(new.section,new.field_key) then raise exception 'Unknown built-in question';end if;
 elsif new.field_key !~ '^q_[a-f0-9]{32}$' then raise exception 'Invalid custom question key';end if;
 if TG_OP='UPDATE' and (new.field_key,new.kind,new.section) is distinct from (old.field_key,old.kind,old.section) then raise exception 'Remove and add a new question to change its response type';end if;
 if exists(select 1 from jsonb_array_elements(new.options) v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 100) then raise exception 'Choices must be short text';end if;
 if new.kind='choice' and jsonb_array_length(new.options)=0 then raise exception 'Add at least one choice';end if;
 if TG_OP='INSERT' and (select count(*) from public.ascender_fields where centre_id=new.centre_id and section=new.section)>=100 then raise exception 'This section has reached 100 question settings';end if;
 return new;
end $$;
revoke all on function ascender_private.field_definition_guard() from public,anon,authenticated;
create trigger question_definition before insert or update on public.ascender_fields for each row execute function ascender_private.field_definition_guard();
create function ascender_private.answer_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare f public.ascender_fields;v jsonb;cid uuid;
begin
 cid:=case when TG_TABLE_NAME='ascender_centres' then new.id else (to_jsonb(new)->>'centre_id')::uuid end;
 for f in select * from public.ascender_fields where centre_id=cid and section=TG_TABLE_NAME and kind<>'builtin' and not removed loop
  v:=new.custom_answers->f.field_key;
  if v is null or v='null'::jsonb then continue;end if;
  if (f.kind='number' and jsonb_typeof(v)<>'number') or (f.kind='checkbox' and jsonb_typeof(v)<>'boolean') or (f.kind in('text','textarea','date','url','email','choice') and jsonb_typeof(v)<>'string') then raise exception 'Invalid answer type for %',f.label;end if;
  if f.kind='url' and (v#>>'{}') !~ '^https://[^/@[:space:]]+([/?#]|$)' then raise exception 'Use an HTTPS link without embedded login details';end if;
  if f.kind='email' and (v#>>'{}') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email';end if;
  if f.kind='date' then perform (v#>>'{}')::date;end if;
  if f.kind='choice' and not f.options @> jsonb_build_array(v) and (TG_OP<>'UPDATE' or old.custom_answers->f.field_key is distinct from v) then raise exception 'Choose an available answer for %',f.label;end if;
 end loop;
 return new;
end $$;
revoke all on function ascender_private.answer_guard() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['ascender_fields','ascender_inventory'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy sites_read on public.%I for select to authenticated using((select ascender_private.can_manage()))',t);
  execute format('create policy sites_insert on public.%I for insert to authenticated with check((select ascender_private.can_manage()))',t);
  execute format('create policy sites_update on public.%I for update to authenticated using((select ascender_private.can_manage())) with check((select ascender_private.can_manage()))',t);
  execute format('create trigger centre_change before insert or update on public.%I for each row execute function ascender_private.record_change()',t);
 end loop;
 foreach t in array array['ascender_centres','ascender_rooms','ascender_programmes','ascender_documents','compliance_items','ascender_deployments','ascender_inventory'] loop
  execute format('create trigger validate_answers before insert or update on public.%I for each row execute function ascender_private.answer_guard()',t);
 end loop;
end $$;
