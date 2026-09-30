import React, { useState } from 'react'
import { useNews, useNewsMutations } from '../hooks/useNewsManager'
import { Plus, Edit, Trash2, Bell, X, Calendar, MapPin, AlertCircle, Layout, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { useBranch } from '../hooks/useBranch'
import { agentRequest, type AgentReply } from '../fets-ai/fets-ai-api'

const NewsModal = ({ isOpen, onClose, newsItem, onSave }) => {
  const [formData, setFormData] = useState({
    content: newsItem?.content || '',
    priority: newsItem?.priority || 'normal',
    branch_location: newsItem?.branch_location || 'global',
    expires_at: newsItem?.expires_at ? format(new Date(newsItem.expires_at), 'yyyy-MM-dd') : '',
    is_active: newsItem?.is_active ?? true,
  })

  const handleSave = async () => {
    if (!formData.content.trim()) {
      toast.error('Content is required.')
      return
    }

    const payload = {
      ...formData,
      id: newsItem?.id,
      expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null
    }

    await onSave(payload)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#e0e5ec] neomorphic-card w-full max-w-xl overflow-hidden shadow-2xl rounded-3xl border border-white/50"
      >
        <div className="p-6 border-b border-gray-200/50 bg-white/30 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">{newsItem ? 'Edit Notice' : 'New Notice'}</h3>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">Broadcast Communication</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-xl transition-colors text-gray-500"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <Layout size={14} /> Message Content
            </label>
            <textarea
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              className="w-full p-4 bg-white/60 rounded-xl border-none shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff] focus:ring-2 focus:ring-amber-500/20 outline-none text-gray-700 font-medium leading-relaxed"
              rows={5}
              placeholder="Type your notice message here..."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <AlertCircle size={14} /> Priority Level
              </label>
              <div className="relative">
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full p-3 bg-white/60 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-amber-500/20 outline-none appearance-none font-bold text-gray-700"
                >
                  <option value="normal">Query / Normal</option>
                  <option value="high">Critical / High</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className={`w-2 h-2 rounded-full ${formData.priority === 'high' ? 'bg-red-500' : 'bg-blue-500'}`} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <MapPin size={14} /> Target Branch
              </label>
              <select
                value={formData.branch_location}
                onChange={e => setFormData({ ...formData, branch_location: e.target.value })}
                className="w-full p-3 bg-white/60 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-amber-500/20 outline-none font-bold text-gray-700"
              >
                <option value="global">Global (All Branches)</option>
                <option value="calicut">Calicut</option>
                <option value="cochin">Cochin</option>
                <option value="kannur">Kannur</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Calendar size={14} /> Auto-Expiry Date
              </label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full p-3 bg-white/60 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-amber-500/20 outline-none font-medium text-gray-700"
              />
              <p className="text-[10px] text-gray-400 font-medium ml-1">Optional: Auto-remove after date</p>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <Bell size={14} /> Publication Status
              </label>
              <select
                value={String(formData.is_active)}
                onChange={e => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                className="w-full p-3 bg-white/60 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-amber-500/20 outline-none font-bold text-gray-700"
              >
                <option value="true">Live / Published</option>
                <option value="false">Draft / Hidden</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200/50 bg-white/30 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
          >
            {newsItem ? 'Update Notice' : 'Post Notice'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function NewsManager() {
  const { data: newsItems = [], isLoading } = useNews()
  const { addNewsItem, updateNewsItem, deleteNewsItem } = useNewsMutations()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedNewsItem, setSelectedNewsItem] = useState(null)

  const openModal = (item = null) => {
    setSelectedNewsItem(item)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setSelectedNewsItem(null)
    setIsModalOpen(false)
  }

  const handleSave = async (itemData) => {
    try {
      if (itemData.id) {
        await updateNewsItem(itemData)
        toast.success('Notice updated successfully')
      } else {
        await addNewsItem(itemData)
        toast.success('Notice posted successfully')
      }
    } catch (error) {
      console.error("Failed to save notice", error)
    }
  }

  // --- AI INTEGRATION ---
  const { activeBranch } = useBranch()
  const [aiAnalysis, setAiAnalysis] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true)
    const noticeText = newsItems.filter(n => n.is_active && (activeBranch==='global'||n.branch_location==='global'||String(n.branch_location).toLowerCase().includes(activeBranch))).map(n =>
      `- [${n.priority.toUpperCase()}] (${n.branch_location}): ${n.content}`
    ).join('\n')
    const activeNotices=noticeText.slice(0,3500)

    const prompt = `Summarise these user-provided active notices for a quick briefing. Highlight critical alerts first. Keep it concise and professional. ${noticeText.length>3500?'The notice list was truncated; say this is a partial briefing.':'This is the complete list supplied by the page.'}
    
    NOTICES:
    ${activeNotices}`

    try {
       const response = await agentRequest<AgentReply>({action:'chat',branch:activeBranch,page:'news-manager',message:prompt});
       setAiAnalysis(response.text);
    } catch (e) {
      toast.error('AI Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-800 tracking-tighter uppercase relative z-10">
            Notice <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-yellow-500">Board</span>
          </h1>
          <p className="text-gray-500 font-medium mt-2 text-lg">
            Manage global announcements and branch-specific alerts.
          </p>
        </div>
        <div className="flex gap-2">
           <button
             onClick={handleAiAnalysis}
             disabled={isAnalyzing}
             className="px-6 py-3 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all font-bold shadow-sm hover:shadow-md flex items-center gap-2"
           >
             <Sparkles className={`w-5 h-5 ${isAnalyzing ? 'animate-spin' : ''}`} />
             <span>{isAnalyzing ? 'Analyzing...' : 'AI Briefing'}</span>
           </button>
           <button
             onClick={() => openModal()}
             className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all font-bold shadow-lg hover:shadow-xl flex items-center gap-2"
           >
             <Plus className="w-5 h-5" />
             <span>New Notice</span>
           </button>
        </div>
      </div>

      <AnimatePresence>
        {aiAnalysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gradient-to-r from-amber-50 to-white p-6 rounded-3xl border border-amber-200 shadow-inner relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <Sparkles size={120} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-sm font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={14} /> FETS Intelligence Briefing
                 </h3>
                 <button onClick={() => setAiAnalysis('')} className="p-1 hover:bg-black/5 rounded-full"><X size={14} /></button>
              </div>
              <div className="prose prose-sm max-w-none text-gray-700 font-medium">
                  {aiAnalysis.split('\n').map((line, i) => (
                    <p key={i} className="mb-1">{line}</p>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-3xl animate-pulse" />
          ))
        ) : newsItems.length === 0 ? (
          <div className="text-center py-20 bg-gray-100 rounded-3xl border-2 border-dashed border-gray-300">
            <Bell size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400">No active notices</h3>
            <p className="text-gray-400">Create your first announcement to get started.</p>
          </div>
        ) : (
          newsItems.map(item => (
            <motion.div
              key={item.id}
              layoutId={`notice-${item.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group sm:flex items-start gap-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all relative overflow-hidden"
            >
              {/* Status Indicator Bar */}
              <div className={`absolute top-0 left-0 bottom-0 w-2 ${item.is_active ? (item.priority === 'high' ? 'bg-red-500' : 'bg-blue-500') : 'bg-gray-300'}`} />

              <div className="flex-1 pl-4">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.is_active ? (item.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600') : 'bg-gray-100 text-gray-500'}`}>
                    {item.is_active ? (item.priority === 'high' ? 'High Priority' : 'Normal Priority') : 'Archived / Draft'}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">
                    <MapPin size={10} /> {item.branch_location || 'Global'}
                  </span>
                  {item.expires_at && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded">
                      <Calendar size={10} /> Expires: {format(new Date(item.expires_at), 'dd MMM')}
                    </span>
                  )}
                </div>

                <p className={`text-lg font-medium leading-relaxed ${item.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                  {item.content}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-4 sm:mt-0 pl-4 sm:pl-0 sm:self-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openModal(item)}
                  className="p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-amber-100 hover:text-amber-600 transition-colors shadow-sm"
                  title="Edit Notice"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => deleteNewsItem(item.id)}
                  className="p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-red-100 hover:text-red-500 transition-colors shadow-sm"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <NewsModal
            isOpen={isModalOpen}
            onClose={closeModal}
            newsItem={selectedNewsItem}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default NewsManager
