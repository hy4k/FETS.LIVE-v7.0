import type { Scope } from './core.ts';
import { checked, uuid } from './runtime.ts';
/** Only this server RPC resolves User Management authority; client role hints are ignored. */
export async function loadScope(db:any,userId:string,branch:unknown):Promise<Scope>{
 if(typeof branch!=='string'||!/^([a-z][a-z0-9_-]{0,79})$/.test(branch))throw new Error('Select a valid centre first.');
 const a=checked(await db.rpc('fets_ai_access',{p_branch:branch}),'Your current workspace access could not be verified');
 if(!a||a.userId!==userId||a.branch!==branch||!uuid(a.profileId)||typeof a.admin!=='boolean'||!Array.isArray(a.modules)||!Array.isArray(a.operations))throw new Error('Your account or centre access could not be verified.');
 const strings=(v:any)=>Array.isArray(v)?v.filter((s:any)=>typeof s==='string'):[];
 const permissions=Object.fromEntries(Object.entries(a.permissions||{}).filter(([k,v])=>/^(ws_[a-z_-]+|can_edit_roster|is_roster_active|user_management_edit)$/.test(k)&&typeof v==='boolean')) as Record<string,boolean>;
 const centres=strings(a.centres);if(branch!=='global'&&!centres.includes(branch))centres.push(branch);
 return {userId,branch,admin:a.admin,profileIds:[a.profileId],role:typeof a.role==='string'?a.role:'staff',permissions,modules:strings(a.modules),operations:strings(a.operations),centres};
}
export const hasModule=(scope:Scope,module:string)=>Boolean(scope.admin||scope.modules?.includes(module));
