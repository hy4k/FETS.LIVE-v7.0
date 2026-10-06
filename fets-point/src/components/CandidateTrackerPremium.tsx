import { useState, useMemo, memo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Plus, Search, Edit, UserCheck, UserX, Phone, X, Calendar,
  Trash2, FileText, Download, ChevronLeft, ChevronRight,
  CheckCircle, Grid, List, FileSpreadsheet, MapPin, Activity, TrendingUp, RefreshCw
} from 'lucide-react'
import { formatDateForIST } from '../utils/dateUtils'
import { CandidateAnalysis } from './CandidateAnalysis'
import { useAuth } from '../hooks/useAuth'
import { useBranch } from '../hooks/useBranch'
import { useBranchFilter } from '../hooks/useBranchFilter'
import {
  useCandidates,
  useCreateCandidate,
  useUpdateCandidateStatus,
  useUpdateCandidate,
  useDeleteCandidate,
  useTotalCandidatesCount
} from '../hooks/useQueries'
import { useClients, useClientExams } from '../hooks/useClients'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Candidate {
  id: string
  fullName: string
  address: string
  phone?: string
  examDate?: Date
  examName?: string
  status: 'registered' | 'completed' | 'no_show'
  rosterNumber?: string
  examPart?: string
  examStartTime?: string
  confirmationNumber: string
  notes?: string
  createdAt: Date
  clientName?: string
  branchLocation?: string
}

const CLIENT_LOGOS: Record<string, string> = {
  'PROMETRIC': '/client-logos/prometric.png',
  'PSI': '/client-logos/psi.png',
  'ITTS': '/client-logos/itts.png',
  'PEARSON VUE': '/client-logos/pearson_vue.png'
}

// Simple Clean Card Component
// Compact Button Card Component
const CandidateCard = memo(({ candidate, onClick }: any) => {
  const clientLogo = candidate.clientName ? CLIENT_LOGOS[candidate.clientName.toUpperCase()] : '/fets-point-logo.png'

  return (
    <motion.button
      whileHover={{ scale: 1.02, backgroundColor: '#f8fafc' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(candidate)}
      className="w-full flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-amber-400 group transition-all duration-200"
    >
      <div className="flex items-center space-x-4 overflow-hidden">
        <div className="w-10 h-10 flex-shrink-0 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center p-1.5 grayscale group-hover:grayscale-0 transition-all">
          <img src={clientLogo} alt="" className="w-full h-full object-contain" />
        </div>
        <div className="text-left overflow-hidden">
          <div className="text-sm font-bold text-slate-800 truncate">{candidate.fullName}</div>
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">
            {candidate.clientName} • {candidate.examName}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 ml-4">
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
          <ChevronRight size={16} className="text-slate-400 group-hover:text-amber-600" />
        </div>
      </div>
    </motion.button>
  )
})



export function CandidateTrackerPremium() {
  const { user, profile } = useAuth()
  const { activeBranch } = useBranch()
  const { isGlobalView } = useBranchFilter()

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeTab, setActiveTab] = useState<'register' | 'analysis'>('register')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterClient, setFilterClient] = useState('all')
  const [filterExam, setFilterExam] = useState('all')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [locationFilter, setLocationFilter] = useState(activeBranch || 'all')
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    setLocationFilter(activeBranch || 'all')
  }, [activeBranch])

  const [showModal, setShowModal] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null)

  const [formData, setFormData] = useState({
    fullName: '', phone: '', address: '',
    examDate: new Date().toISOString().slice(0, 10),
    examName: '', clientName: '', notes: '', rosterNumber: '', examPart: '', examStartTime: ''
  })

  // Queries
  const filters = useMemo(() => ({
    branch_location: locationFilter !== 'all' ? locationFilter : undefined,
    startDate: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(currentDate), 'yyyy-MM-dd')
  }), [locationFilter, currentDate])

  const { data: rawCandidates, isLoading, refetch } = useCandidates(filters)

  // Fetch clients and exams from database
  const { data: dbClients = [] } = useClients()
  const { data: dbExams = [] } = useClientExams()

  // Mutations
  const createMutation = useCreateCandidate()
  const updateStatusMutation = useUpdateCandidateStatus()
  const updateMutation = useUpdateCandidate()
  const deleteMutation = useDeleteCandidate()

  // Process data
  const candidates: Candidate[] = useMemo(() => rawCandidates?.map(c => ({
    id: c.id, fullName: c.full_name, address: c.address, phone: c.phone || '',
    examDate: c.exam_date ? new Date(`${formatDateForIST(c.exam_date)}T12:00:00`) : undefined,
    examName: c.exam_name || 'General Exam',
    status: (c.status as Candidate['status']) || 'registered',
    confirmationNumber: c.roster_number || c.confirmation_number || 'N/A',
    rosterNumber: c.roster_number || '', examPart: c.exam_part || '', examStartTime: c.exam_start_time || '',
    createdAt: new Date(c.created_at), clientName: c.client_name,
    branchLocation: c.branch_location, notes: c.notes || ''
  })) || [], [rawCandidates])

  const filteredCandidates = useMemo(() => {
    const s = searchQuery.toLowerCase();
    return candidates.filter(c => {
      const matchSearch = c.fullName.toLowerCase().includes(s) || c.confirmationNumber.toLowerCase().includes(s);
      const matchClient = filterClient === 'all' || (c.clientName || '').toUpperCase() === filterClient.toUpperCase();
      const matchExam = filterExam === 'all' || (c.examName || '').toLowerCase().includes(filterExam.toLowerCase());
      const matchDay = format(c.examDate || new Date(), 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd');
      return matchSearch && matchClient && matchExam && matchDay;
    })
  }, [candidates, searchQuery, filterClient, filterExam, currentDate])

  // New Stats Logic
  const dayRegistry = useMemo(() => {
    const day = format(currentDate, 'yyyy-MM-dd');
    return candidates.filter(c => format(c.examDate || new Date(), 'yyyy-MM-dd') === day).length;
  }, [candidates, currentDate]);

  const monthTotal = useMemo(() => {
    const currentMonth = format(currentDate, 'yyyy-MM');
    return candidates.filter(c => format(c.examDate || new Date(), 'yyyy-MM') === currentMonth).length;
  }, [candidates, currentDate]);

  const { data: grandTotal = 0 } = useTotalCandidatesCount(locationFilter);

  // Handlers
  const handleOpenAdd = () => {
    setIsEdit(false)
    setFormData({
      fullName: '', phone: '', address: '',
      examDate: new Date().toISOString().slice(0, 10),
      examName: '', clientName: '', notes: '', rosterNumber: '', examPart: '', examStartTime: ''
    })
    setShowModal(true)
  }

  const handleOpenEdit = (c: Candidate) => {
    setIsEdit(true)
    setSelectedCandidate(c)
    // Uploaded rosters store the client in capitals and exam names as written in
    // the file, so match the lists without caring about case; a value with no
    // match is still shown (it gets its own option below) rather than blanked.
    const same = (a?: string, b?: string) => (a || '').trim().toUpperCase() === (b || '').trim().toUpperCase()
    const client = dbClients.find(x => same(x.name, c.clientName))
    const exam = client ? dbExams.find(e => e.client_id === client.id && same(e.name, c.examName)) : undefined
    setFormData({
      fullName: c.fullName,
      phone: c.phone || '',
      address: c.address || '',
      examDate: c.examDate ? format(c.examDate, 'yyyy-MM-dd') : '',
      examName: exam?.name || (c.examName === 'General Exam' ? '' : c.examName || ''),
      clientName: client?.name || c.clientName || '',
      notes: c.notes || '', rosterNumber: c.rosterNumber || '', examPart: c.examPart || '', examStartTime: c.examStartTime || ''
    })
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Delete this candidate entry?")) {
      deleteMutation.mutate(id, { onSuccess: () => refetch() })
    }
  }

  const handleSave = () => {
    if (!formData.fullName || !formData.clientName) {
      return toast.error("Please fill in Full Name and Client Name")
    }

    const targetBranch = isEdit ? selectedCandidate.branchLocation : activeBranch;
    if (!['calicut','cochin'].includes(targetBranch)) return toast.error('Choose Calicut or Cochin before adding a candidate');
    const payload: any = {
      full_name: formData.fullName,
      phone: formData.phone,
      address: formData.address,
      exam_date: formData.examDate ? `${formData.examDate}T00:00:00+05:30` : null,
      roster_number: formData.rosterNumber.trim() || null,
      exam_part: formData.examPart.trim() || null,
      exam_start_time: formData.examStartTime || null,
      exam_name: formData.examName,
      client_name: formData.clientName.trim().toUpperCase(),
      notes: formData.notes,
      branch_location: targetBranch,
      user_id: user?.id
    }

    if (isEdit) {
      updateMutation.mutate({ id: selectedCandidate.id, updates: payload }, {
        onSuccess: () => {
          setShowModal(false);
          refetch();
        }
      })
    } else {
      payload.status = 'registered';
      payload.confirmation_number = `FETS-${Math.floor(100000 + Math.random() * 900000)}`;
      createMutation.mutate(payload, {
        onSuccess: () => {
          setShowModal(false);
          refetch();
        }
      })
    }
  }

  const exportToExcel = () => {
    const data = filteredCandidates.map(c => ({
      'Date': c.examDate ? format(c.examDate, 'dd/MM/yyyy') : '',
      'Name': c.fullName,
      'Phone no': c.phone || 'N/A',
      'Place': c.address || 'N/A'
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Candidates")
    XLSX.writeFile(wb, `FETS_Register_${format(new Date(), 'ddMMyyyy')}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    const tableData = filteredCandidates.map(c => [
      c.examDate ? format(c.examDate, 'dd/MM/yyyy') : '',
      c.fullName,
      c.phone || 'N/A',
      c.address || 'N/A'
    ])
    autoTable(doc, {
      head: [['Date', 'Name', 'Phone no', 'Place']],
      body: tableData,
      styles: { fontSize: 8 }
    })
    doc.save(`FETS_Register_${format(new Date(), 'ddMMyyyy')}.pdf`)
    toast.success("PDF report downloaded")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading candidates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen -mt-32 pt-56 bg-[#e0e5ec]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Functional Notification Banner Spacer */}
      <div className="h-6 -mx-8 -mt-8 mb-8"></div>

      <div className="max-w-[1800px] mx-auto px-6">
        {/* Executive Header - Neumorphic */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gold-gradient mb-2 uppercase">
              FETS Register
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              {activeBranch && activeBranch !== 'global' ? `${activeBranch.charAt(0).toUpperCase() + activeBranch.slice(1)} · ` : ''}Candidate Tracking & Management
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 font-semibold uppercase tracking-wider text-sm">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-8 p-1.5 bg-slate-200/50 rounded-2xl w-fit shadow-inner">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${activeTab === 'register' ? 'bg-white shadow-md text-slate-800 transform scale-105' : 'text-slate-500 hover:bg-white/50'}`}
          >
            <List size={14} />
            Register
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all ${activeTab === 'analysis' ? 'bg-white shadow-md text-slate-800 transform scale-105' : 'text-slate-500 hover:bg-white/50'}`}
          >
            <Activity size={14} />
            Analysis
          </button>
        </div>

        {activeTab === 'register' ? (
          <>
            {/* Control Toolbar - Neumorphic */}
            <div className="neomorphic-card p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                {/* Location Filter */}
                <div className="flex items-center px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm min-w-[140px]">
                  <MapPin size={16} className="text-amber-500 mr-2" />
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs font-bold uppercase tracking-widest text-slate-600 cursor-pointer w-full"
                  >
                    <option value="all">All Locations</option>
                    <option value="calicut">Calicut</option>
                    <option value="cochin">Cochin</option>
                    <option value="kannur">Kannur</option>
                    <option value="global">Global</option>
                  </select>
                </div>

                {/* Month Navigation */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                    className="neomorphic-btn-icon"
                    title="Previous month"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <div className="text-xl font-bold text-gray-700 min-w-[200px] text-center">
                    {format(currentDate, 'MMMM yyyy')}
                  </div>
                  <button
                    onClick={() => setCurrentDate(subMonths(currentDate, -1))}
                    className="neomorphic-btn-icon"
                    title="Next month"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </button>
                </div>

                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-sm"
                >
                  Today
                </button>
              </div>

              <div className="flex items-center space-x-4 flex-wrap gap-2">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search candidates..."
                    className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none w-64 shadow-sm"
                  />
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <List size={18} />
                  </button>
                </div>

                {/* Export Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={exportToExcel}
                    className="p-2.5 bg-white border border-slate-200 text-green-600 rounded-xl shadow-sm hover:shadow-md hover:bg-green-50 transition-all"
                    title="Export to Excel"
                  >
                    <FileSpreadsheet size={18} />
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="p-2.5 bg-white border border-slate-200 text-red-600 rounded-xl shadow-sm hover:shadow-md hover:bg-red-50 transition-all"
                    title="Export to PDF"
                  >
                    <FileText size={18} />
                  </button>
                </div>

                {/* Add Candidate Button */}
                <button
                  onClick={handleOpenAdd}
                  className="px-5 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center space-x-2 font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                >
                  <Plus size={18} />
                  <span>Add Candidate</span>
                </button>
              </div>
            </div>

            {/* Stats Section - Premium Chips */}
            <div className="flex flex-wrap gap-4 mb-8">
              <div className="px-6 py-4 bg-[#002147] rounded-2xl shadow-lg flex flex-col min-w-[180px]">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Today's Registry</span>
                <span className="text-3xl font-black text-white">{dayRegistry}</span>
              </div>
              <div className="px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-w-[180px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monthly Total</span>
                <span className="text-3xl font-black text-slate-800">{monthTotal}</span>
              </div>
              <div className="px-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-w-[180px]">
                <span className="text-[10px] font-black text-[#C5A023] uppercase tracking-widest mb-1">Grand Total</span>
                <span className="text-3xl font-black text-slate-800">{grandTotal}</span>
              </div>
            </div>

            {/* Enhanced Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client:</span>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-amber-500 transition-all"
                >
                  <option value="all">All Clients</option>
                  {['PROMETRIC', 'PSI', 'ITTS', 'PEARSON VUE'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exam:</span>
                <input
                  type="text"
                  placeholder="Filter by exam..."
                  value={filterExam}
                  onChange={(e) => setFilterExam(e.target.value)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-amber-500 transition-all w-48"
                />
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Day:</span>
                <input
                  type="date"
                  value={format(currentDate, 'yyyy-MM-dd')}
                  onChange={(e) => setCurrentDate(new Date(e.target.value))}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            {/* Candidates Grid/List Content */}
            <div className="bg-white/80 backdrop-blur-sm rounded-[2.5rem] p-8 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.8),9px_9px_16px_#bec3c9] min-h-[600px] border border-white/60">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredCandidates.map(candidate => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      onClick={(c: any) => {
                        setSelectedCandidate(c);
                        setShowDetailModal(true);
                      }}
                    />
                  ))}
                  {filteredCandidates.length === 0 && (
                    <div className="col-span-full py-20 text-center opacity-60">
                      <Search size={48} className="mx-auto mb-4 text-slate-300" />
                      <p className="text-xl font-bold text-slate-400">No candidates found matching your criteria</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#002147] border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Name</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Phone</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Client</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Exam</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-amber-400 uppercase tracking-widest">Place</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black text-amber-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCandidates.map(candidate => (
                        <tr key={candidate.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                            {candidate.fullName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">
                            {candidate.phone || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                            {candidate.clientName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                            {candidate.examName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                            {candidate.address || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                            <button
                              onClick={() => { setSelectedCandidate(candidate); setShowDetailModal(true); }}
                              className="text-[#002147] hover:text-amber-600 font-bold transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleOpenEdit(candidate)}
                              className="text-slate-400 hover:text-blue-600 font-bold transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredCandidates.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center opacity-60">
                            <p className="text-sm font-bold text-slate-400">No candidates found matching your criteria</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <CandidateAnalysis onClose={() => setActiveTab('register')} />
        )}
      </div>

      {/* Candidate Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedCandidate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#002147]/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-white/20"
            >
              <div className="bg-[#002147] p-8 text-white relative">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-16 h-16 bg-white rounded-2xl p-3 flex items-center justify-center">
                    <img
                      src={selectedCandidate.clientName ? CLIENT_LOGOS[selectedCandidate.clientName.toUpperCase()] : '/fets-point-logo.png'}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">{selectedCandidate.fullName}</h2>
                    <p className="text-amber-400 text-xs font-black uppercase tracking-widest">
                      {selectedCandidate.clientName} Candidate
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Phone Number</label>
                    <p className="font-bold text-slate-800">{selectedCandidate.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Confirmation</label>
                    <p className="font-mono font-bold text-amber-600">{selectedCandidate.confirmationNumber}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Exam Name</label>
                    <p className="font-bold text-slate-800">{selectedCandidate.examName}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Exam Date</label>
                    <p className="font-bold text-slate-800">
                      {selectedCandidate.examDate ? format(selectedCandidate.examDate, 'dd MMMM yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Placement/Address</label>
                  <p className="font-bold text-slate-800">{selectedCandidate.address || 'N/A'}</p>
                </div>

                {selectedCandidate.notes && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Administrative Notes</label>
                    <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 leading-relaxed italic border border-slate-100">
                      "{selectedCandidate.notes}"
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 pt-0 flex gap-3">
                <button
                  onClick={() => { setShowDetailModal(false); handleOpenEdit(selectedCandidate); }}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <Edit size={16} /> Edit Entry
                </button>
                <button
                  onClick={() => { setShowDetailModal(false); handleDelete(selectedCandidate.id); }}
                  className="px-6 py-4 bg-rose-50 text-rose-600 font-bold rounded-2xl hover:bg-rose-100 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal - Clean and Simple like the image */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white text-slate-900 rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20 [&_input]:bg-white [&_input]:text-slate-900 [&_select]:bg-white [&_select]:text-slate-900 [&_textarea]:bg-white [&_textarea]:text-slate-900 [&_input::placeholder]:text-slate-400 [&_textarea::placeholder]:text-slate-400"
            >
              <div className="p-10 border-b border-slate-100 bg-[#002147] text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                      {isEdit ? 'Update Candidate' : 'New Registration'}
                    </h2>
                    <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mt-2">
                      FETS Operational Platform Registry
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-3 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+91..."
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>

                  {([{key:'rosterNumber',label:'Provider roster / confirmation ID',type:'text'},{key:'examPart',label:'Exam part',type:'text'},{key:'examStartTime',label:'Exam start time · IST',type:'time'}] as const).map(field=><label key={field.key} className="block text-sm font-medium text-gray-700 mb-2">{field.label}<input type={field.type} value={formData[field.key]} onChange={e=>setFormData({...formData,[field.key]:e.target.value})} className="mt-2 w-full px-4 py-3 border border-gray-300 rounded-lg font-normal focus:outline-none focus:ring-2 focus:ring-yellow-400"/></label>)}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Client Name
                    </label>
                    <select
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value, examName: '' })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                      <option value="">Select client...</option>
                      {formData.clientName && !(dbClients.length > 0 ? dbClients.map(c => c.name) : ['PROMETRIC', 'PSI', 'ITTS', 'PEARSON VUE']).includes(formData.clientName) && (
                        <option value={formData.clientName}>{formData.clientName}</option>
                      )}
                      {dbClients.length > 0 ? (
                        dbClients.map(client => (
                          <option key={client.id} value={client.name}>{client.name}</option>
                        ))
                      ) : (
                        <>
                          <option value="PROMETRIC">PROMETRIC</option>
                          <option value="PSI">PSI</option>
                          <option value="ITTS">ITTS</option>
                          <option value="PEARSON VUE">PEARSON VUE</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Exam Name
                    </label>
                    {(() => {
                      const selectedClient = dbClients.find(c => c.name === formData.clientName)
                      const clientExams = selectedClient ? dbExams.filter(e => e.client_id === selectedClient.id) : []

                      return clientExams.length > 0 ? (
                        <select
                          value={formData.examName}
                          onChange={(e) => setFormData({ ...formData, examName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        >
                          <option value="">Select exam...</option>
                          {formData.examName && !clientExams.some(e => e.name === formData.examName) && (
                            <option value={formData.examName}>{formData.examName}</option>
                          )}
                          {clientExams.map(exam => (
                            <option key={exam.id} value={exam.name}>{exam.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="e.g. TOEFL iBT"
                          value={formData.examName}
                          onChange={(e) => setFormData({ ...formData, examName: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      )
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Exam Date
                    </label>
                    <input
                      type="date"
                      value={formData.examDate}
                      onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Address
                    </label>
                    <input
                      type="text"
                      placeholder="City, State"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Notes
                    </label>
                    <textarea
                      placeholder="Additional requirements..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-8 py-4 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-10 py-4 bg-[#002147] text-white rounded-2xl hover:bg-slate-800 font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  {isEdit ? 'Save Changes' : 'Confirm Registration'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CandidateTrackerPremium
