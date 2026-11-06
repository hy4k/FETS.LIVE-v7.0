import {useEffect} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../hooks/useAuth';
import {fetchSeatContext} from './api';
import type {SeatContext} from './types';

export function useSeatContext(branch:string,from:string,through:string){
  const {user}=useAuth();
  const client=useQueryClient();
  useEffect(()=>{const refresh=()=>{void client.invalidateQueries({queryKey:['seat-context']});};window.addEventListener('fets-data-loaded',refresh);return()=>window.removeEventListener('fets-data-loaded',refresh);},[client]);
  return useQuery<SeatContext,Error>({
    queryKey:['seat-context',user?.id,branch,from,through],
    enabled:!!user&&!!from&&!!through&&['calicut','cochin','global'].includes(branch),
    queryFn:async()=>{
      if(branch!=='global')return fetchSeatContext(branch as 'calicut'|'cochin',from,through);
      const rows=await Promise.all([fetchSeatContext('calicut',from,through),fetchSeatContext('cochin',from,through)]);
      return{rules:rows.flatMap(r=>r.rules),details:rows.flatMap(r=>r.details),can_edit_rules:false,adjacent_sessions:rows.flatMap(r=>r.adjacent_sessions||[])};
    },
    staleTime:10000,refetchInterval:60000,refetchOnWindowFocus:true,retry:1
  });
}
