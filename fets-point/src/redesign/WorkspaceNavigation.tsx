import { useState } from 'react';
import { Grid2X2 } from 'lucide-react';
import WorkspaceMenu from './WorkspaceMenu';
export default function WorkspaceNavigation({navigate}:{navigate:(page:string)=>void}) {
 const [open,setOpen]=useState(false);
 const items=[{id:'command-center',label:'Home'},{id:'my-desk',label:'My Desk'},{id:'fets-calendar',label:'Calendar'},{id:'fets-roster',label:'Roster'},{id:'fets-chat',label:'Team space'},{id:'actionables',label:'Actionables'},{id:'profile',label:'My profile'}];
 return <><nav aria-label="Workspace navigation" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 28px',background:'#f3f5ee',borderBottom:'1px solid #e0e7d7',color:'#355240'}}><button onClick={()=>navigate('command-center')} style={{border:0,background:'none',fontSize:19,fontWeight:700,letterSpacing:-1,color:'inherit'}}>fets.live</button><button onClick={()=>setOpen(true)} style={{display:'flex',alignItems:'center',gap:8,border:0,background:'none',fontSize:12,color:'inherit'}}><Grid2X2 size={17}/> Your workspace</button></nav><WorkspaceMenu open={open} onClose={()=>setOpen(false)} onPick={item=>navigate(item.id)} items={items}/></>;
}
