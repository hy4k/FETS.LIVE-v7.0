import { ArrowUpRight, Sparkles } from 'lucide-react';
/** All Gemini entry points now open the persistent FETS AI companion. */
export const GeminiLiveStudio = ({embedded=false,onOpenTeamChat}: {embedded?:boolean;onOpenTeamChat?:()=>void;branch?:string}) => <section className="fets-ai-entry" style={{padding:embedded?24:36,borderRadius:22,background:'linear-gradient(135deg,#eef2e6,#eee7f3)',color:'#345240'}}>
  <Sparkles size={24}/><h2 style={{fontFamily:'Newsreader,Georgia,serif',fontSize:32,margin:'15px 0 10px'}}>Meet FETS AI. Right here with you.</h2>
  <p style={{fontSize:13,lineHeight:1.7,marginBottom:22}}>Your work companion follows you across FETS LIVE. Ask about the day, prepare a handover, or start a voice session with camera and screen sharing.</p>
  <button onClick={()=>window.dispatchEvent(new Event('fets-open-ai'))} style={{border:0,borderRadius:99,padding:'12px 20px',background:'#3c5b46',color:'#fff',display:'inline-flex',alignItems:'center',gap:15,cursor:'pointer'}}>Open FETS AI <ArrowUpRight size={16}/></button>
  {onOpenTeamChat&&<button onClick={onOpenTeamChat} style={{marginLeft:15,border:0,background:'none',color:'#576c50',cursor:'pointer'}}>Team chat</button>}
</section>;
