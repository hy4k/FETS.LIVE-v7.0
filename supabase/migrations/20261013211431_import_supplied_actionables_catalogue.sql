-- Import only the user-confirmed catalogue. Do not delete or overwrite existing work.
begin;
alter table public.expansion_institutions add column actionables_reference jsonb check(actionables_reference is null or jsonb_typeof(actionables_reference)='object');
create unique index mission_catalogue_reference on public.expansion_institutions((actionables_reference->>'id')) where actionables_reference is not null;
alter table public.mission_work_items add column reference_task_key integer check(reference_task_key between 1 and 5), add column source_team text;
create unique index mission_reference_task on public.mission_work_items(reference_task_key) where reference_task_key is not null;
-- Scope imported institutions and their work to approved project membership.
create policy project_institution_scope on public.expansion_institutions as restrictive for all to authenticated
using(actionables_reference is null or (select fets_actionables_private.access()))
with check(actionables_reference is null or (select fets_actionables_private.access()));
create policy project_work_scope on public.mission_work_items as restrictive for all to authenticated
using(institution_id is null or exists(select 1 from public.expansion_institutions i where i.id=institution_id))
with check(institution_id is null or exists(select 1 from public.expansion_institutions i where i.id=institution_id));
create policy project_stage_scope on public.mission_institution_stages as restrictive for all to authenticated
using(exists(select 1 from public.expansion_institutions i where i.id=institution_id))
with check(exists(select 1 from public.expansion_institutions i where i.id=institution_id));
create policy project_result_scope on public.mission_task_updates as restrictive for all to authenticated
using(exists(select 1 from public.mission_work_items w where w.id=work_item_id))
with check(exists(select 1 from public.mission_work_items w where w.id=work_item_id));

do $$
declare item jsonb; centre uuid; district_name text; matches integer;
begin
 for item in select value from jsonb_array_elements($catalogue$[
  {
    "id": "cochin-rajagiri",
    "district": "cochin",
    "districtName": "Cochin (Ernakulam)",
    "type": "Autonomous College",
    "name": "Rajagiri College of Social Sciences",
    "address": "Rajagiri Valley P.O., Kakkanad, Kochi, Ernakulam District",
    "pincode": "682039",
    "phone": "+91 484 266 0601",
    "nodal": "Principal / HOD Computer Science",
    "capacity": "100 Seats",
    "status": "Inspected",
    "score": 90
  },
  {
    "id": "cochin-cusat",
    "district": "cochin",
    "districtName": "Cochin (Ernakulam)",
    "type": "State University",
    "name": "Cochin University of Science and Tech (CUSAT)",
    "address": "CUSAT P.O., South Kalamassery, Kochi, Ernakulam",
    "pincode": "682022",
    "phone": "+91 484 257 5396",
    "nodal": "Head, Dept of Computer Applications",
    "capacity": "120 Seats",
    "status": "Pitch Sent",
    "score": 80
  },
  {
    "id": "cochin-mec",
    "district": "cochin",
    "districtName": "Cochin (Ernakulam)",
    "type": "Govt Engineering College",
    "name": "Govt. Model Engineering College (MEC)",
    "address": "Thrikkakara, Edappally, Kochi, Ernakulam",
    "pincode": "682021",
    "phone": "+91 484 257 5370",
    "nodal": "Principal / HOD CSE",
    "capacity": "80 Seats",
    "status": "Scouted",
    "score": 70
  },
  {
    "id": "cochin-sh",
    "district": "cochin",
    "districtName": "Cochin (Ernakulam)",
    "type": "Autonomous Arts/Commerce",
    "name": "Sacred Heart College (Autonomous)",
    "address": "Pandit Karuppan Road, Thevara, Kochi, Ernakulam",
    "pincode": "682013",
    "phone": "+91 484 287 0500",
    "nodal": "Dean of Commerce",
    "capacity": "70 Seats",
    "status": "Scouted",
    "score": 60
  },
  {
    "id": "cochin-blastline",
    "district": "cochin",
    "districtName": "Cochin (Ernakulam)",
    "type": "Private IT Institute",
    "name": "Blastline Institute of Technology",
    "address": "3rd Floor, Johns Tower, Near Metro Pillar 485, Edappally, Kochi",
    "pincode": "682024",
    "phone": "+91 81290 00500",
    "nodal": "Center Director",
    "capacity": "45 Seats",
    "status": "Certified",
    "score": 100
  },
  {
    "id": "thrissur-vidya",
    "district": "thrissur",
    "districtName": "Thrissur",
    "type": "Engineering College",
    "name": "Vidya Academy of Science & Technology",
    "address": "Thalakottukara P.O., Near Kaiparambu, Thrissur District",
    "pincode": "680501",
    "phone": "+91 4885 287 751",
    "nodal": "Principal / Head of CS",
    "capacity": "110 Seats",
    "status": "Inspected",
    "score": 90
  },
  {
    "id": "thrissur-sahrdaya",
    "district": "thrissur",
    "districtName": "Thrissur",
    "type": "Engineering College",
    "name": "Sahrdaya College of Engineering & Tech",
    "address": "PB No. 17, Kodakara, Thrissur District",
    "pincode": "680684",
    "phone": "+91 480 272 6630",
    "nodal": "Director's Office / IT Lead",
    "capacity": "90 Seats",
    "status": "MoU Signed",
    "score": 90
  },
  {
    "id": "thrissur-christ",
    "district": "thrissur",
    "districtName": "Thrissur",
    "type": "Engineering College",
    "name": "Christ College of Engineering",
    "address": "Cathedral Junction, Irinjalakuda, Thrissur",
    "pincode": "680125",
    "phone": "+91 480 282 5355",
    "nodal": "Principal / HOD Computer Engg",
    "capacity": "75 Seats",
    "status": "Pitch Sent",
    "score": 70
  },
  {
    "id": "thrissur-stthomas",
    "district": "thrissur",
    "districtName": "Thrissur",
    "type": "Autonomous College",
    "name": "St. Thomas College (Autonomous)",
    "address": "Post Office Road, Thrissur Town, Thrissur",
    "pincode": "680001",
    "phone": "+91 487 242 0435",
    "nodal": "Principal / HOD Commerce",
    "capacity": "60 Seats",
    "status": "Scouted",
    "score": 60
  },
  {
    "id": "thrissur-atees",
    "district": "thrissur",
    "districtName": "Thrissur",
    "type": "Private IT Institute",
    "name": "ATEES Industrial Training Pvt Ltd",
    "address": "Kuriland Tower, Marar Road, Thrissur Town",
    "pincode": "680001",
    "phone": "+91 85890 12025",
    "nodal": "Technical Director",
    "capacity": "40 Seats",
    "status": "Scouted",
    "score": 70
  },
  {
    "id": "thrissur-nexlern",
    "district": "thrissur",
    "districtName": "Thrissur",
    "type": "Private IT Institute",
    "name": "Nexlern Academy LLP",
    "address": "Grace Complex, Sankara Iyer Rd, MG Road, Thrissur",
    "pincode": "680004",
    "phone": "+91 81368 37383",
    "nodal": "Academy Director",
    "capacity": "35 Seats",
    "status": "Scouted",
    "score": 70
  },
  {
    "id": "calicut-gec",
    "district": "calicut",
    "districtName": "Calicut (Kozhikode)",
    "type": "Govt Engineering College",
    "name": "Government Engineering College Kozhikode",
    "address": "Kannur Road, West Hill, Kozhikode District",
    "pincode": "673005",
    "phone": "+91 495 238 3210",
    "nodal": "Principal / HOD CSE",
    "capacity": "95 Seats",
    "status": "Inspected",
    "score": 90
  },
  {
    "id": "calicut-vedavyasa",
    "district": "calicut",
    "districtName": "Calicut (Kozhikode)",
    "type": "Engineering College",
    "name": "Vedavyasa Institute of Technology",
    "address": "Karad Road, Vazhayur, Kozhikode/Malappuram Border",
    "pincode": "673633",
    "phone": "+91 483 283 2157",
    "nodal": "Campus Director",
    "capacity": "80 Seats",
    "status": "Pitch Sent",
    "score": 70
  },
  {
    "id": "calicut-vadakara",
    "district": "calicut",
    "districtName": "Calicut (Kozhikode)",
    "type": "Engineering College",
    "name": "College of Engineering Vadakara",
    "address": "Mandarathur P.O., Kurunthodi, Vadakara, Kozhikode",
    "pincode": "673105",
    "phone": "+91 496 253 7225",
    "nodal": "IT Nodal Officer",
    "capacity": "70 Seats",
    "status": "Scouted",
    "score": 60
  },
  {
    "id": "calicut-devagiri",
    "district": "calicut",
    "districtName": "Calicut (Kozhikode)",
    "type": "Autonomous College",
    "name": "St. Joseph's College (Devagiri)",
    "address": "Devagiri College P.O., Kozhikode",
    "pincode": "673008",
    "phone": "+91 495 235 5901",
    "nodal": "Commerce Faculty Head",
    "capacity": "75 Seats",
    "status": "Scouted",
    "score": 70
  },
  {
    "id": "calicut-ipsr",
    "district": "calicut",
    "districtName": "Calicut (Kozhikode)",
    "type": "Private IT Institute",
    "name": "IPSR Solutions Limited",
    "address": "3rd Floor, Vyapar Bhavan, Bank Road, Kozhikode",
    "pincode": "673001",
    "phone": "+91 94471 69776",
    "nodal": "Regional Lead",
    "capacity": "50 Seats",
    "status": "Certified",
    "score": 100
  },
  {
    "id": "calicut-aamiz",
    "district": "calicut",
    "districtName": "Calicut (Kozhikode)",
    "type": "Private IT Institute",
    "name": "AAMIZ Institute of Technology",
    "address": "Grand Plaza, Rajaji Road, Stadium Junction, Kozhikode",
    "pincode": "673004",
    "phone": "+91 90617 44166",
    "nodal": "Head of Testing Services",
    "capacity": "40 Seats",
    "status": "Scouted",
    "score": 70
  },
  {
    "id": "kannur-gec",
    "district": "kannur",
    "districtName": "Kannur",
    "type": "Govt Engineering College",
    "name": "Government Engineering College Kannur",
    "address": "Mangattuparamba, Parassinikkadavu P.O., Kannur",
    "pincode": "670563",
    "phone": "+91 497 278 0226",
    "nodal": "Principal / HOD Computer Science",
    "capacity": "85 Seats",
    "status": "Inspected",
    "score": 80
  },
  {
    "id": "kannur-vimal",
    "district": "kannur",
    "districtName": "Kannur",
    "type": "Engineering College",
    "name": "Vimal Jyothi Engineering College",
    "address": "Jyothi Nagar, Chemperi P.O., Kannur",
    "pincode": "670632",
    "phone": "+91 460 221 2220",
    "nodal": "Network Administrator",
    "capacity": "80 Seats",
    "status": "Pitch Sent",
    "score": 70
  },
  {
    "id": "kannur-chinmaya",
    "district": "kannur",
    "districtName": "Kannur",
    "type": "Management & Tech",
    "name": "Chinmaya Institute of Technology",
    "address": "Govind Giri, Chala, Thottada P.O., Kannur",
    "pincode": "670007",
    "phone": "+91 497 282 2923",
    "nodal": "MCA Department Head",
    "capacity": "60 Seats",
    "status": "Scouted",
    "score": 60
  },
  {
    "id": "kannur-catalyst",
    "district": "kannur",
    "districtName": "Kannur",
    "type": "Private Testing Hub",
    "name": "Catalyst Education Tech Hub",
    "address": "Royal Plaza, Near New Bus Stand, SN Park Road, Kannur",
    "pincode": "670001",
    "phone": "+91 97450 12345",
    "nodal": "Center Director",
    "capacity": "40 Seats",
    "status": "Certified",
    "score": 90
  },
  {
    "id": "kottayam-saintgits",
    "district": "kottayam",
    "districtName": "Kottayam",
    "type": "Engineering College",
    "name": "Saintgits College of Engineering",
    "address": "Kottukulam Hills, Pathamuttom P.O., Kottayam",
    "pincode": "686532",
    "phone": "+91 481 243 6169",
    "nodal": "Principal / HOD CS",
    "capacity": "95 Seats",
    "status": "MoU Signed",
    "score": 90
  },
  {
    "id": "kottayam-amaljyothi",
    "district": "kottayam",
    "districtName": "Kottayam",
    "type": "Autonomous Engineering",
    "name": "Amal Jyothi College of Engineering",
    "address": "Kanjirappally, Koovappally P.O., Kottayam",
    "pincode": "686518",
    "phone": "+91 4828 305 500",
    "nodal": "IT Infrastructure Lead",
    "capacity": "110 Seats",
    "status": "Pitch Sent",
    "score": 80
  },
  {
    "id": "kottayam-cms",
    "district": "kottayam",
    "districtName": "Kottayam",
    "type": "Autonomous College",
    "name": "CMS College Kottayam (Autonomous)",
    "address": "CMS College Road, Kottayam Town, Kottayam",
    "pincode": "686001",
    "phone": "+91 481 256 6002",
    "nodal": "HOD Commerce",
    "capacity": "65 Seats",
    "status": "Scouted",
    "score": 60
  },
  {
    "id": "kottayam-marian",
    "district": "kottayam",
    "districtName": "Kottayam",
    "type": "Autonomous College",
    "name": "Marian College Kuttikkanam",
    "address": "Kuttikkanam P.O., Peermade, Idukki / Kottayam Border",
    "pincode": "685531",
    "phone": "+91 4869 232 203",
    "nodal": "Director of IT & Exams",
    "capacity": "75 Seats",
    "status": "Scouted",
    "score": 70
  }
]$catalogue$::jsonb) loop
  if exists(select 1 from public.expansion_institutions where actionables_reference->>'id'=item->>'id') then continue;end if;
  district_name:=case item->>'district' when 'cochin' then 'Ernakulam' when 'calicut' then 'Calicut' when 'thrissur' then 'Thrissur' when 'kannur' then 'Kannur' when 'kottayam' then 'Kottayam' end;
  select count(*) into matches from public.expansion_institutions where lower(btrim(name))=lower(btrim(item->>'name')) and district::text=district_name;
  if matches>1 then raise exception 'Resolve duplicate institutions before importing %',item->>'name';end if;
  if matches=1 then
   select id into centre from public.expansion_institutions where lower(btrim(name))=lower(btrim(item->>'name')) and district::text=district_name;
   -- Preserve staff's current contact details and all existing work; attach the source snapshot only.
   update public.expansion_institutions set actionables_reference=item where id=centre;
  else
   insert into public.expansion_institutions(name,district,address,primary_contact_name,primary_contact_phone,lab_seat_capacity,stage,actionables_reference)
   select r.name,r.district,r.address,r.primary_contact_name,r.primary_contact_phone,r.lab_seat_capacity,r.stage,r.actionables_reference
   from jsonb_populate_record(null::public.expansion_institutions,jsonb_build_object(
    'name',item->>'name','district',district_name,'address',(item->>'address')||', PIN '||(item->>'pincode'),
    'primary_contact_name',item->>'nodal','primary_contact_phone',item->>'phone',
    'lab_seat_capacity',split_part(item->>'capacity',' ',1)::integer,
    'stage',case item->>'status' when 'Scouted' then 'identified' when 'Pitch Sent' then 'contacted' when 'Inspected' then 'mou_review' when 'MoU Signed' then 'mou_review' when 'Certified' then 'pearson_approved' end,'actionables_reference',item
   )) r;
  end if;
 end loop;
end $$;
create table public.mission_project_brief (
 id text primary key check(id='seven-centres-2027'),
 tasks jsonb not null check(jsonb_typeof(tasks)='array')
);
alter table public.mission_project_brief enable row level security;
create policy project_brief_read on public.mission_project_brief for select to authenticated using((select fets_actionables_private.access()));
revoke all on public.mission_project_brief from public,anon,authenticated;
grant select on public.mission_project_brief to authenticated;
grant all on public.mission_project_brief to service_role;
insert into public.mission_project_brief(id,tasks) values('seven-centres-2027',$brief$[
  {
    "id": 1,
    "title": "Dispatch Multi-Exam Pearson VUE Dossier to Rajagiri College",
    "assignee": "Scout Squad",
    "status": "todo",
    "priority": "high"
  },
  {
    "id": 2,
    "title": "Conduct Physical 4-ft Spacing Verification at Vidya Academy Thrissur",
    "assignee": "Tech Audit Squad",
    "status": "inprogress",
    "priority": "high"
  },
  {
    "id": 3,
    "title": "Install Pearson VUE Site Manager Browser at Saintgits Kottayam",
    "assignee": "Pearson Liaison",
    "status": "done",
    "priority": "high"
  },
  {
    "id": 4,
    "title": "Review Generator Zero-Transfer Latency at GEC Kozhikode",
    "assignee": "Tech Audit Squad",
    "status": "todo",
    "priority": "medium"
  },
  {
    "id": 5,
    "title": "Finalize Commercial Revenue Sharing with Sahrdaya Kodakara",
    "assignee": "Operations Lead",
    "status": "inprogress",
    "priority": "high"
  }
]$brief$::jsonb);
create function public.mission_catalogue_origin_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.actionables_reference is not null and not public.fets_actionables_can_manage() then raise exception 'Management removes institutions from the supplied catalogue';end if;
  return old;
 end if;
 if tg_op='UPDATE' and new.actionables_reference is distinct from old.actionables_reference then raise exception 'Keep the supplied project reference intact; edit the working contact details instead';end if;
 if tg_op='INSERT' and new.actionables_reference is not null and auth.uid() is not null then raise exception 'Project reference imports require the reviewed migration';end if;
 return new;
end $$;
create trigger mission_catalogue_origin_guard before insert or update or delete on public.expansion_institutions for each row execute function public.mission_catalogue_origin_guard();
create function public.mission_reference_task_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.institution_id is distinct from old.institution_id and exists(select 1 from public.expansion_institutions where id=old.institution_id and actionables_reference is not null) then raise exception 'Project work stays with its institution';end if;
 if new.institution_id is not null and not exists(select 1 from public.expansion_institutions where id=new.institution_id) then raise exception 'Open an accessible institution before assigning work';end if;
 if exists(select 1 from public.expansion_institutions where id=new.institution_id and actionables_reference is not null) then
  if new.owner_id is not null and not exists(select 1 from fets_actionables_private.directory() d where d.id=new.owner_id and d.is_active) then raise exception 'Choose an approved project colleague to own this duty';end if;
  if new.report_to_id is not null and not exists(select 1 from fets_actionables_private.directory() d where d.user_id=new.report_to_id and d.is_active) then raise exception 'Choose an approved project colleague to receive the result';end if;
 end if;
 if tg_op='UPDATE' and new.reference_task_key is distinct from old.reference_task_key then raise exception 'A linked project task keeps its source identity';end if;
 if new.reference_task_key is not null and not exists(select 1 from public.expansion_institutions where id=new.institution_id and actionables_reference->>'id'=case new.reference_task_key when 1 then 'cochin-rajagiri' when 2 then 'thrissur-vidya' when 3 then 'kottayam-saintgits' when 4 then 'calicut-gec' when 5 then 'thrissur-sahrdaya' end) then raise exception 'Link the project task to its recorded institution';end if;
 if tg_op='INSERT' and new.reference_task_key is not null then
  if new.reference_task_key=3 then raise exception 'This project task is already recorded complete; add a separate follow-up if needed';end if;
  new.status:=case when new.reference_task_key in (2,5) then 'in_progress' else 'open' end;
 end if;
 new.source_team:=case new.reference_task_key when 1 then 'Scout Squad' when 2 then 'Tech Audit Squad' when 3 then 'Pearson Liaison' when 4 then 'Tech Audit Squad' when 5 then 'Operations Lead' else null end;
 return new;
end $$;
create trigger mission_reference_task_guard before insert or update on public.mission_work_items for each row execute function public.mission_reference_task_guard();
revoke all on function public.mission_catalogue_origin_guard(),public.mission_reference_task_guard() from public,anon;
grant execute on function public.mission_catalogue_origin_guard(),public.mission_reference_task_guard() to authenticated,service_role;

create function public.mission_project_stage_scope_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.institution_id is distinct from old.institution_id and exists(select 1 from public.expansion_institutions where id=old.institution_id and actionables_reference is not null) then raise exception 'Project stages stay with their institution';end if;
 return new;
end $$;
create trigger mission_project_stage_scope_guard before update on public.mission_institution_stages for each row execute function public.mission_project_stage_scope_guard();
revoke all on function public.mission_project_stage_scope_guard() from public,anon;
grant execute on function public.mission_project_stage_scope_guard() to authenticated,service_role;
notify pgrst,'reload schema';
commit;
