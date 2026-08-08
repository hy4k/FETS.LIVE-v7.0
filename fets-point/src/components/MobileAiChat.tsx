import React, { useState, useRef, useEffect } from 'react';
import {
   Send, Sparkles, User, Brain,
   Trash2, ChevronLeft, Mic, Image as ImageIcon,
   MoreVertical, Zap, Bot, Smartphone, ShieldCheck, Cpu, Power,
   ChevronRight, RefreshCw, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { askFetsAgent } from '../lib/fetsAgent';

interface Message {
   id: string;
   text: string;
   sender: 'user' | 'ai';
   timestamp: Date;
}

export function MobileAiChat() {
   const { profile } = useAuth();
   const [messages, setMessages] = useState<Message[]>([
      { id: '1', text: "Hello! I am FETS AI. How can I assist with your operations today?", sender: 'ai', timestamp: new Date() }
   ]);
   const [input, setInput] = useState('');
   const [isTyping, setIsTyping] = useState(false);
   const [showPairing, setShowPairing] = useState(false);
   const [pairingCode, setPairingCode] = useState('');
   const [isPairing, setIsPairing] = useState(false);

   const scrollRef = useRef<HTMLDivElement>(null);
   const conversationId = useRef<string | null>(null);

   useEffect(() => {
      if (scrollRef.current) {
         scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
   }, [messages, isTyping]);

   const handleSend = async () => {
      if (!input.trim()) return;

      const userMsg: Message = {
         id: Date.now().toString(),
         text: input,
         sender: 'user',
         timestamp: new Date()
      };

      setMessages(prev => [...prev, userMsg]);
      const outgoing = input;
      setInput('');
      setIsTyping(true);

      try {
         const result = await askFetsAgent(outgoing, { conversationId: conversationId.current });
         conversationId.current = result.conversationId;
         const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            text: result.response,
            sender: 'ai',
            timestamp: new Date()
         };
         setMessages(prev => [...prev, aiMsg]);

         const writes = (result.actions ?? []).filter(a => a.ok && !['read_table', 'aggregate', 'search_memory'].includes(a.name));
         if (writes.length > 0) toast.success(`Performed ${writes.length} action${writes.length > 1 ? 's' : ''}`);
      } catch (error: any) {
         toast.error(error?.message || 'AI connection failed');
         setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            text: `Sorry, I hit an error: ${error?.message || 'connection failed'}.`,
            sender: 'ai',
            timestamp: new Date()
         }]);
      } finally {
         setIsTyping(false);
      }
   };

   const generatePairingCode = () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setPairingCode(code);
      setShowPairing(true);
   };

   const handlePair = async () => {
      setIsPairing(true);
      try {
         // Here we would call the actual pairing logic
         await new Promise(r => setTimeout(r, 2000));
         toast.success("Mobile Node Sync Initiated");
         setShowPairing(false);
      } finally {
         setIsPairing(false);
      }
   };

   return (
      <div className="flex flex-col h-screen bg-[#0F172A] pb-32 pt-safe overflow-hidden">

         {/* GLOWING HEADER */}
         <div className="px-6 pt-8 pb-6 border-b border-white/10 flex items-center justify-between bg-[#0F172A]/80 backdrop-blur-xl relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 p-0.5 shadow-lg shadow-indigo-500/20">
                  <div className="w-full h-full rounded-[14px] bg-[#0F172A] flex items-center justify-center">
                     <Bot size={24} className="text-white" />
                  </div>
               </div>
               <div>
                  <h1 className="text-white font-black text-lg leading-none tracking-tight uppercase">FETS AI</h1>
                  <div className="flex items-center gap-1.5 mt-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-emerald-500/80 text-[9px] font-black uppercase tracking-widest">Neural Link Active</span>
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={generatePairingCode} className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 active:scale-95 transition-all">
                  <Smartphone size={20} />
               </button>
               <button className="p-3 rounded-2xl bg-white/5 text-white/40">
                  <MoreVertical size={18} />
               </button>
            </div>
         </div>

         {/* CHAT BUBBLES */}
         <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth custom-scrollbar">
            {messages.map((msg, i) => (
               <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
               >
                  <div className={`max-w-[85%] flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                     {msg.sender === 'ai' && (
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 ml-4">FETS AI</span>
                     )}
                     <div className={`px-6 py-4 rounded-[32px] text-sm leading-relaxed shadow-xl ${msg.sender === 'user'
                           ? 'bg-gradient-to-tr from-amber-500 to-amber-600 text-[#3E2723] font-bold rounded-tr-lg border border-amber-400/30'
                           : 'bg-white/5 backdrop-blur-md text-slate-100 border border-white/10 rounded-tl-lg shadow-inner'
                        }`}>
                        {msg.text}
                     </div>
                     <span className="text-[7px] font-bold text-white/10 uppercase tracking-tighter mt-2 px-4">
                        {format(msg.timestamp, 'HH:mm')}
                     </span>
                  </div>
               </motion.div>
            ))}

            {isTyping && (
               <div className="flex justify-start items-center gap-3 ml-4">
                  <div className="flex gap-1.5">
                     <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                     <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                     <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
               </div>
            )}
         </div>

         {/* GLOWING INPUT BOX */}
         <div className="px-6 py-8 bg-[#0F172A] border-t border-white/5 relative z-20">
            <div className="relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-[35px] blur opacity-10 group-focus-within:opacity-25 transition-opacity" />
               <div className="relative bg-[#1E293B] rounded-[30px] flex items-center p-2 shadow-2xl border border-white/5">
                  <button className="p-3 rounded-full text-white/20 hover:text-white/50 transition-colors">
                     <Mic size={20} />
                  </button>
                  <input
                     type="text"
                     placeholder="Message FETS AI..."
                     value={input}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                     className="flex-1 bg-transparent border-none outline-none text-white text-sm px-2 placeholder-white/10"
                  />
                  <motion.button
                     whileTap={{ scale: 0.9 }}
                     onClick={handleSend}
                     className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20"
                  >
                     <Send size={20} />
                  </motion.button>
               </div>
            </div>
         </div>

         {/* PAIRING MODAL (Native Style) */}
         <AnimatePresence>
            {showPairing && (
               <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed inset-0 z-[100] bg-[#0F172A] flex flex-col pt-safe px-8"
               >
                  <div className="pt-12 pb-8 flex items-center justify-between">
                     <button onClick={() => setShowPairing(false)} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                        <X size={24} />
                     </button>
                     <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Node Control</h2>
                     <div className="w-12" />
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-12">
                     <div className="relative w-48 h-48">
                        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
                        <div className="absolute inset-4 rounded-full border-4 border-indigo-500/40 animate-pulse" />
                        <div className="absolute inset-0 flex items-center justify-center">
                           <Smartphone size={80} className="text-indigo-400" />
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none italic">Pair Mobile Node</h3>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[280px] mx-auto uppercase tracking-widest opacity-60">Authorize FETSAI to perform secure operations on this device.</p>
                     </div>

                     <div className="bg-white/5 p-8 rounded-[40px] border border-white/5 w-full space-y-6">
                        <div className="flex justify-between items-center text-left">
                           <div>
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Authorization Code</p>
                              <p className="text-4xl font-black text-white tracking-[0.2em]">{pairingCode}</p>
                           </div>
                           <button className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                              <RefreshCw size={20} />
                           </button>
                        </div>
                     </div>

                     <button
                        onClick={handlePair}
                        disabled={isPairing}
                        className="w-full py-6 rounded-[30px] bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-black uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all"
                     >
                        {isPairing ? 'SYNCING...' : 'REGISTER NODE'}
                     </button>
                  </div>

                  <div className="pb-12 pt-8 flex items-center justify-center gap-4 opacity-20">
                     <ShieldCheck size={16} className="text-indigo-400" />
                     <span className="text-[8px] font-black text-white uppercase tracking-[0.4em]">Secure Grid Authentication</span>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

      </div>
   );
}
