import {newsPost,industryPost,newsSource,newsDraft,newsConfig} from './news-fixture';
import {fixturePlan,fixtureDay,fixtureRecord,fixtureChecks} from "./shift-v2-fixture";
import React from "react";
// Isolated read-only fixtures: never imported by a production entry point.
export const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  full_name: "Example Administrator",
  email: "mithun@fets.in",
  role: "super_admin",
  branch_assigned: "calicut",
  base_centre: "calicut",
  is_active: true,
  permissions: {},
  joining_date: "2026-01-01",
};
export const user = {
  id: profile.user_id,
  email: profile.email,
  app_metadata: { role: "super_admin" },
};
const day = new Date().toISOString().slice(0, 7) + "-02";
const sessions = [
  {
    id: 1,
    date: day,
    branch_location: "calicut",
    client_name: "PROMETRIC",
    exam_name: "CMA US",
    candidate_count: 9,
    start_time: null,
    end_time: null,
  },
  {
    id: 2,
    date: day,
    branch_location: "cochin",
    client_name: "PSI",
    exam_name: "Example exam",
    candidate_count: 10,
    start_time: "09:00:00",
    end_time: "11:00:00",
  },
];
const params = new URLSearchParams(location.search);
function rows(table: string) {
  if(params.has('news')){
    if(table==='fets_news_posts')return [newsPost,industryPost];
    if(table==='fets_news_drafts')return [newsDraft];
    if(table==='fets_news_sources')return [newsSource];
    if(table==='fets_news_receipts'||table==='fets_news_collection_runs')return [];
  }
  if(params.has('shift')){
    if(table==='shift_days_v2')return [fixtureRecord];
    if(table==='shift_work_events_v2')return [];
    if(table==='centre_duty_members')return [{profile_id:profile.id,user_id:profile.user_id,branch:'*',role:'super_admin'}];
    if(table==='staff_profiles')return [profile,...fixturePlan.people.filter(p=>p.id!==profile.id).map(p=>({id:p.id,user_id:p.id,full_name:p.name,branch_assigned:'calicut',is_active:true,permissions:{}}))];
    if(table==='roster_schedules')return fixturePlan.people.filter(p=>!p.support).map(p=>({profile_id:p.id,date:fixtureDay,shift_code:'D',shift_start:String(Math.floor(p.start/60)).padStart(2,'0')+':'+String(p.start%60).padStart(2,'0'),shift_end:String(Math.floor(p.end/60)).padStart(2,'0')+':'+String(p.end%60).padStart(2,'0'),branch_location:'calicut',staff_profiles:{id:p.id,user_id:p.id,full_name:p.name,branch_assigned:'calicut',is_active:true,permissions:{}}}));
  }

  if (params.has("empty")) return [];
  switch (table) {
    case "roster_schedules":
      return [1,2,3,4,5,6,7,8,9,10].map(n=>({id:'time-roster-'+n,profile_id:profile.id,date:new Date().toISOString().slice(0,7)+'-'+String(n).padStart(2,'0'),shift_code:n===4||n===9?'RD':n===5?'HD':'D',shift_label:n===5?'First half':'Early shift',shift_start:n===4||n===9?null:'06:00',shift_end:n===4||n===9?null:n===5?'10:30':'15:00',grace_minutes:0,overtime_hours:n===3?1:0,branch_location:'calicut',version:1}));
    case "staff_attendance":
      return [1,2,3,5,6,7,8,10].map(n=>({id:'time-attendance-'+n,staff_id:profile.id,date:new Date().toISOString().slice(0,7)+'-'+String(n).padStart(2,'0'),check_in:'06:00',check_out:n===10?null:n===5?'10:30':n===3?'16:00':'15:00',status:'present',branch_location:'calicut',notes:n===5?null:JSON.stringify({breakMins:30,steps:[{out:'12:00',in:'12:30'}]})}));
    case "staff_profiles":
      return [profile];
    case "fets_vault": return [{id:'fixture-vault',user_id:user.id,title:'Example staff portal',category:'Client portals',username:'sample-user',url:'https://example.test',site_id:'Sample site',password:'training-sample-only',notes:'Isolated design fixture. Not a production credential.',created_at:'2026-10-01',custom_fields:[{key:'Reference',value:'Sample reference'}]}];
    case "clients":
      return [
        { id: "paragon", name: "PARAGON", color: "teal", softwares: [] },
        { id: "client", name: "PROMETRIC", color: "#008080", softwares: [] },
        { id: "psi", name: "PSI", color: "#dd8800", softwares: [] },
      ];
    case "client_exams":
      return [
        {
          id: "celpip",
          client_id: "paragon",
          name: "CELPIP",
          locations: ["calicut", "cochin"],
        },
      ];
    case "calendar_sessions":
      return params.has('landing') ? sessions.map((session, index) => ({...session, date: new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()), branch_location:'calicut', start_time:index ? '13:30:00' : '08:00:00', end_time:index ? '17:30:00' : '12:00:00', status:'scheduled'})) : sessions;
    case "ascender_centres":
      return ["calicut", "cochin", "mobile"].map((code, i) => ({
        id: "centre" + i,
        code,
        version: 1,
        updated_at: new Date().toISOString(),
      }));
    default:
      return [];
  }
}
function chain(table: string, rpc = false) {
  (window as any).auditReads = ((window as any).auditReads || 0) + 1;
  let one = false,
    from = 0,
    to = 999;
  const filters: any[] = [];
  let q: any;
  const result = () => {
    let data: any = rows(table);
    if (rpc)
      data =
        table === "ascender_capabilities"
          ? true
          : table === "fets_workspace_capabilities"
            ? {
                version: 5,
                desk: true,
                duties: true,
                blueprint: true,
                dutyReview: true,
                dutyWorkflow: true,
              }
            : table === "fets_actionables_capabilities"
              ? { version: 2, rollout: true }
              : [];
    if(rpc&&table==='fets_shift_check_snapshot_v2')data=fixtureChecks;
    if(rpc&&table==='desk_team_round')data={day:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),choice:null,participants:[]};
    if(rpc&&table==='desk_team_round_join')throw Error('Writes disabled in page audit');
    if(rpc&&table==='fets_news_context')data=params.has('staff-news')?{can_review:false}:newsConfig;
    if (!rpc) {
      for (const [key, value] of filters)
        data = data.filter((r: any) =>
          key === "__calicut"
            ? r.branch_location == null || r.branch_location === "calicut"
            : r[key] === undefined || r[key] === value,
        );
      data = data.slice(from, to + 1);
      if (one) data = data[0] || null;
    }
    return { data, error: null, count: Array.isArray(data) ? data.length : 0 };
  };
  q = new Proxy(
    {},
    {
      get(_t, key) {
        if (key === "then")
          return (resolve: any, reject: any) =>
            Promise.resolve(result()).then(resolve, reject);
        if (key === "single" || key === "maybeSingle")
          return () => {
            one = true;
            return q;
          };
        if (key === "range")
          return (a: number, b: number) => {
            from = a;
            to = b;
            return q;
          };
        if (key === "or")
          return () => {
            filters.push(["__calicut", true]);
            return q;
          };
        if (key === "eq")
          return (k: string, v: any) => {
            filters.push([k, v]);
            return q;
          };
        if (["insert", "update", "upsert", "delete"].includes(String(key)))
          return () => {
            throw Error("Writes disabled in page audit");
          };
        return () => q;
      },
    },
  );
  return q;
}
const channel: any = {
  on() {
    return channel;
  },
  subscribe() {
    return channel;
  },
  unsubscribe: async () => {},
  track: async () => {},
  presenceState: () => ({}),
};
export const supabase: any = {
  from: (table: string) => chain(table),
  rpc: (name: string) => chain(name, true),
  channel: () => channel,
  removeChannel: async () => {},
  removeAllChannels: async () => {},
  auth: {
    getUser: async () => ({ data: { user }, error: null }),
    getSession: async () => ({
      data: { session: { user, access_token: "isolated-fixture" } },
      error: null,
    }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  functions: {
    invoke: async () => ({
      data: null,
      error: { message: "External integration disabled in isolated audit" },
    }),
  },
  storage: {
    from: () => ({
      createSignedUrl: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
    }),
  },
};
export const useAuth = () => ({
  profile,
  user,
  loading: false,
  hasPermission: () => true,
  isAdmin: true,
  isSuperAdmin: true,
  signOut: async () => {},
  signIn: async () => {},
  refreshProfile: async () => {},
});
const branch = {
  getBranchTheme:()=>"calicut",
  activeBranch: params.get("branch") || "calicut",
  setActiveBranch: () => {},
  viewMode: "single",
  canAccessBranch: () => true,
  canUseDualMode: () => true,
  userAccessLevel: "super_admin",
  userBranchAccess: "both",
  branchStatus: {},
  loading: false,
};
export const useBranch = () => branch;
export const useTheme = () => ({
  isDarkMode: false,
  theme: "light",
  toggleTheme: () => {},
});
export const useChat = () => ({
  isDetached: false,
  activeUser: null,
  setActiveUser: () => {},
  setIsDetached: () => {},
  toggleDetach: () => {},
});
export const useGlobalCall = () => ({ startCall: async () => {} });
export const useCallCenter = () => ({
  online: new Set(),
  live: {},
  current: null,
  calls: {},
  startCall: async () => {},
  setOpenChat: () => {},
  setNames: () => {},
});
export const supabaseHelpers = new Proxy(
  {},
  { get: () => async () => ({ data: [], error: null }) },
);
export const config = {
  supabaseUrl: "https://invalid.example.test",
  supabaseAnonKey: "isolated",
};
export default supabase;

export const ChatProvider=({children}:any)=>children;
export const CallProvider=({children}:any)=>children;
