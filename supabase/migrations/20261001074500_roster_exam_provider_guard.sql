-- FETS client relationship confirmed by the owner: Anthropic/Claude through Pearson VUE;
-- CMA US through Prometric. Reject wrong assignments rather than silently changing a provider ID key.
create or replace function fets_roster_private.validate_exam_provider() returns trigger language plpgsql set search_path='' as $$
declare expected text;
begin
 if new.exam_name ~* '\m(Claude|Anthropic)\M' then expected:='PEARSON VUE';
 elsif new.exam_name ~* '\mCMA[[:space:]]*US\M' or upper(new.exam_name)='INSTITUTE OF CERTIFIED MANAGEMENT ACCOUNTANTS' then expected:='PROMETRIC';end if;
 if expected is not null and upper(coalesce(new.client_name,''))<>expected then raise exception '% exams must be assigned to client %',new.exam_name,expected;end if;
 return new;
end $$;
create trigger candidates_exam_provider_guard before insert or update of client_name,exam_name on public.candidates for each row execute function fets_roster_private.validate_exam_provider();
