import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Search, X, Grid2X2 } from 'lucide-react';
import './premium-experience.css';
type Item = { id:string; label:string; sub?:string };
export default function WorkspaceMenu({ open, onClose, onPick, items }: { open:boolean; onClose:()=>void; onPick:(item:Item)=>void; items:Item[] }) {
  const dialog = useRef<HTMLDialogElement>(null); const [query,setQuery] = useState(''); const titleId=useId();
  useEffect(() => { if (open) { setQuery(''); if (!dialog.current?.open) dialog.current?.showModal(); } else dialog.current?.close(); },[open]);
  const filtered = items.filter(item => `${item.label} ${item.sub||''}`.toLowerCase().includes(query.toLowerCase()));
  return <dialog ref={dialog} className="workspace-menu" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}}>
    <header><div><span className="premium-eyebrow">MAKE ROOM FOR GOOD WORK</span><h2 id={titleId}>Your workspace.</h2><p>Everything you need, a little closer.</p></div><button onClick={onClose} aria-label="Close workspace menu"><X size={19}/></button></header>
    <label className="workspace-menu-search"><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a page or a tool" aria-label="Find a page or a tool" /></label>
    <div className="workspace-menu-grid">{filtered.map((item,index)=><button key={item.id} onClick={()=>{onPick(item);onClose();}}><span className={`workspace-menu-symbol workspace-menu-symbol--${index%3}`}><Grid2X2 size={19}/></span><ArrowUpRight size={16}/><strong>{item.label}</strong><small>{item.sub||'Open this workspace'}</small></button>)}{!filtered.length&&<p className="workspace-menu-empty">No pages match “{query}”. Try another name.</p>}</div>
    <footer>{filtered.length} places to get things done.<span>fets.live</span></footer>
  </dialog>;
}
