import { useState, useEffect, useCallback } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  Building2, Plus, Search, MoreVertical, Pencil, Trash2, X, Loader2,
  Globe, Phone, Mail, MapPin, FileText, CreditCard, Users, Calendar,
  ChevronRight, IndianRupee, TrendingUp, Star, CheckCircle2, Clock,
  AlertCircle, RefreshCw, Briefcase, Hash, StickyNote, ExternalLink,
  UserCircle, MessageSquare, UploadCloud, Download, Eye,
  BadgeCheck, Zap, BarChart3, ChevronDown, ArrowLeft
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase'

const API = import.meta.env.VITE_API_URL || 'https://tpcrm.onrender.com'

// ── Constants ──────────────────────────────────────────────────────────────────
const INDUSTRIES = [
  'Technology', 'Healthcare', 'Education', 'Finance & Banking', 'Real Estate',
  'Retail & E-Commerce', 'Manufacturing', 'Hospitality', 'Media & Entertainment',
  'Logistics & Supply Chain', 'Construction', 'Legal', 'Consulting', 'Other'
]
const TIERS: Record<string, { label: string; color: string; bg: string; border: string; icon: JSX.Element }> = {
  standard:   { label: 'Standard',   color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200',   icon: <CheckCircle2 size={12} /> },
  premium:    { label: 'Premium',    color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: <Star size={12} /> },
  enterprise: { label: 'Enterprise', color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200',  icon: <Zap size={12} /> },
}
const CLIENT_STATUS: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
  'on-hold': 'bg-amber-100 text-amber-700',
  churned:  'bg-red-100 text-red-600',
}
const BILLING_CYCLES = ['one-time', 'monthly', 'quarterly', 'annually']
const PAYMENT_METHODS = ['bank_transfer', 'upi', 'card', 'cash', 'cheque', 'online']
const PAYMENT_STATUS: Record<string, string> = {
  paid:     'bg-emerald-100 text-emerald-700',
  pending:  'bg-amber-100 text-amber-700',
  overdue:  'bg-red-100 text-red-600',
  refunded: 'bg-slate-100 text-slate-600',
}
const DOC_TYPES = ['contract', 'invoice', 'proposal', 'nda', 'agreement', 'report', 'other']
const SERVICE_STATUS: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  paused:    'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-600',
  completed: 'bg-blue-100 text-blue-700',
}

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600', 'from-purple-500 to-pink-500',
  'from-emerald-500 to-teal-600', 'from-orange-500 to-red-500',
  'from-sky-500 to-cyan-600', 'from-rose-500 to-pink-600',
]
function avatarColor(s: string) { return AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length] }

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon, action, children }: {
  title: string; icon: JSX.Element; action?: JSX.Element; children: React.ReactNode
}) {
  return (
    <div className="glass-card overflow-hidden border border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/40">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">{icon}{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyState({ icon, text, cta }: { icon: JSX.Element; text: string; cta?: JSX.Element }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
      <div className="text-slate-300 mb-1">{icon}</div>
      <p className="text-sm font-medium text-slate-500">{text}</p>
      {cta}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Clients() {
  const { currentUser } = useAuth()
  const [clients, setClients]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<any | null>(null)    // detail view
  const [activeTab, setActiveTab] = useState('overview')
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [saving, setSaving]       = useState(false)

  // Modals
  const [showAddClient, setShowAddClient]     = useState(false)
  const [showEditClient, setShowEditClient]   = useState(false)
  const [showAddContact, setShowAddContact]   = useState(false)
  const [showAddService, setShowAddService]   = useState(false)
  const [showAddPayment, setShowAddPayment]   = useState(false)
  const [showAddMeeting, setShowAddMeeting]   = useState(false)
  const [showAddDoc, setShowAddDoc]           = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [docUploading, setDocUploading]       = useState(false)

  // Forms
  const [clientForm, setClientForm] = useState<any>({
    companyName: '', clientCode: '', industry: '', website: '',
    address: '', city: '', state: '', country: 'India',
    gstin: '', pan: '', accountManager: '', status: 'active',
    tier: 'standard', notes: '', tags: [], leadId: '',
    convertedDate: new Date().toISOString().split('T')[0],
  })
  const [contactForm, setContactForm] = useState({ name: '', designation: '', email: '', phone: '', isPrimary: false })
  const [serviceForm, setServiceForm] = useState({ name: '', description: '', amount: '', currency: 'INR', billingCycle: 'monthly', startDate: '', endDate: '', status: 'active' })
  const [paymentForm, setPaymentForm] = useState({ amount: '', currency: 'INR', date: new Date().toISOString().split('T')[0], method: 'bank_transfer', reference: '', notes: '', status: 'paid' })
  const [meetingForm, setMeetingForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], attendees: '', summary: '', actionItems: '', nextMeetingDate: '' })
  const [docForm, setDocForm]         = useState({ name: '', type: 'contract', url: '', notes: '' })
  const [docFile, setDocFile]         = useState<File | null>(null)

  const token = useCallback(async () => await currentUser?.getIdToken(), [currentUser])

  async function apiFetch(path: string, opts: RequestInit = {}) {
    const t = await token()
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...opts.headers },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Error ${res.status}`)
    }
    return res.json()
  }

  async function fetchClients() {
    setLoading(true)
    try {
      const data = await apiFetch('/clients/')
      setClients(data)
    } catch { toast.error('Failed to load clients') }
    finally { setLoading(false) }
  }

  async function refreshSelected(id: string) {
    try {
      const data = await apiFetch(`/clients/${id}`)
      setSelected(data)
      setClients(prev => prev.map(c => c.id === id ? data : c))
    } catch { /* silent */ }
  }

  useEffect(() => { fetchClients() }, [currentUser])

  // ── Client CRUD ────────────────────────────────────────────────────────────
  async function handleCreateClient() {
    if (!clientForm.companyName) return toast.error('Company name is required')
    setSaving(true)
    try {
      const res = await apiFetch('/clients/', { method: 'POST', body: JSON.stringify({ ...clientForm, contacts: [], services: [], payments: [], documents: [], meetingNotes: [] }) })
      toast.success(`✅ ${clientForm.companyName} added as client!`)
      setShowAddClient(false)
      setClientForm({ companyName: '', clientCode: '', industry: '', website: '', address: '', city: '', state: '', country: 'India', gstin: '', pan: '', accountManager: '', status: 'active', tier: 'standard', notes: '', tags: [], leadId: '', convertedDate: new Date().toISOString().split('T')[0] })
      fetchClients()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleUpdateClient() {
    if (!selected) return
    setSaving(true)
    try {
      await apiFetch(`/clients/${selected.id}`, { method: 'PATCH', body: JSON.stringify(clientForm) })
      toast.success('Client updated!')
      setShowEditClient(false)
      refreshSelected(selected.id)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function handleDeleteClient() {
    if (!selected) return
    try {
      await apiFetch(`/clients/${selected.id}`, { method: 'DELETE' })
      toast.success('Client removed')
      setSelected(null)
      setShowDeleteConfirm(false)
      fetchClients()
    } catch (e: any) { toast.error(e.message) }
  }

  // ── Sub-item helpers ───────────────────────────────────────────────────────
  async function postSub(path: string, body: any, successMsg: string) {
    setSaving(true)
    try {
      await apiFetch(`/clients/${selected.id}${path}`, { method: 'POST', body: JSON.stringify(body) })
      toast.success(successMsg)
      await refreshSelected(selected.id)
      return true
    } catch (e: any) { toast.error(e.message); return false }
    finally { setSaving(false) }
  }

  async function deleteSub(path: string, successMsg: string) {
    try {
      await apiFetch(`/clients/${selected.id}${path}`, { method: 'DELETE' })
      toast.success(successMsg)
      await refreshSelected(selected.id)
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleAddContact() {
    if (!contactForm.name) return toast.error('Contact name required')
    if (await postSub('/contacts', contactForm, 'Contact added!')) {
      setContactForm({ name: '', designation: '', email: '', phone: '', isPrimary: false })
      setShowAddContact(false)
    }
  }

  async function handleAddService() {
    if (!serviceForm.name || !serviceForm.amount) return toast.error('Service name and amount required')
    if (await postSub('/services', { ...serviceForm, amount: parseFloat(serviceForm.amount) }, 'Service added!')) {
      setServiceForm({ name: '', description: '', amount: '', currency: 'INR', billingCycle: 'monthly', startDate: '', endDate: '', status: 'active' })
      setShowAddService(false)
    }
  }

  async function handleAddPayment() {
    if (!paymentForm.amount) return toast.error('Amount required')
    if (await postSub('/payments', { ...paymentForm, amount: parseFloat(paymentForm.amount) }, 'Payment recorded!')) {
      setPaymentForm({ amount: '', currency: 'INR', date: new Date().toISOString().split('T')[0], method: 'bank_transfer', reference: '', notes: '', status: 'paid' })
      setShowAddPayment(false)
    }
  }

  async function handleAddMeeting() {
    if (!meetingForm.title || !meetingForm.summary) return toast.error('Title and summary required')
    if (await postSub('/meetings', meetingForm, 'Meeting note saved!')) {
      setMeetingForm({ title: '', date: new Date().toISOString().split('T')[0], attendees: '', summary: '', actionItems: '', nextMeetingDate: '' })
      setShowAddMeeting(false)
    }
  }

  async function handleAddDoc() {
    let url = docForm.url
    if (docFile) {
      setDocUploading(true)
      try {
        const fileRef = ref(storage, `clients/${selected.id}/${Date.now()}_${docFile.name}`)
        await uploadBytes(fileRef, docFile)
        url = await getDownloadURL(fileRef)
      } catch { toast.error('Upload failed'); setDocUploading(false); return }
      setDocUploading(false)
    }
    if (!docForm.name || !url) return toast.error('Document name and file/URL required')
    if (await postSub('/documents', { ...docForm, url }, 'Document added!')) {
      setDocForm({ name: '', type: 'contract', url: '', notes: '' })
      setDocFile(null)
      setShowAddDoc(false)
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = clients.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const q = search.toLowerCase()
    const matchSearch = !q || c.companyName?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q) || c.clientCode?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const totalRevenue = clients.reduce((a, c) => a + (c.totalPaid || 0), 0)

  // ── Detail tabs ────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview',  label: 'Overview',     icon: <BarChart3 size={14} /> },
    { id: 'contacts',  label: 'Contacts',     icon: <Users size={14} />,      count: selected?.contacts?.length },
    { id: 'services',  label: 'Services',     icon: <Briefcase size={14} />,  count: selected?.services?.length },
    { id: 'payments',  label: 'Payments',     icon: <CreditCard size={14} />, count: selected?.payments?.length },
    { id: 'meetings',  label: 'Meeting Notes',icon: <MessageSquare size={14} />, count: selected?.meetingNotes?.length },
    { id: 'documents', label: 'Documents',    icon: <FileText size={14} />,   count: selected?.documents?.length },
  ]

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      {/* If a client is selected, show detail view; otherwise show list */}
      {selected ? (
        /* ═══ DETAIL VIEW ═══════════════════════════════════════════════════ */
        <div className="space-y-5 animate-fade-in">
          {/* Back bar */}
          <div className="flex items-center justify-between">
            <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors group">
              <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Clients
            </button>
            <div className="flex items-center gap-2">
              <button onClick={() => { setClientForm({ ...selected }); setShowEditClient(true) }} className="btn-secondary text-sm py-2">
                <Pencil size={14} /> Edit
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger text-sm py-2">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          {/* Client hero card */}
          <div className="glass-card p-6 border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className={`flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor(selected.companyName)} flex items-center justify-center text-white font-black text-2xl shadow-md`}>
                {selected.companyName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{selected.companyName}</h1>
                  {selected.clientCode && (
                    <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">#{selected.clientCode}</span>
                  )}
                  <span className={clsx('px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide', CLIENT_STATUS[selected.status] || CLIENT_STATUS.active)}>
                    {selected.status}
                  </span>
                  {TIERS[selected.tier] && (
                    <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border', TIERS[selected.tier].color, TIERS[selected.tier].bg, TIERS[selected.tier].border)}>
                      {TIERS[selected.tier].icon} {TIERS[selected.tier].label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mb-3">{selected.industry}{selected.city ? ` · ${selected.city}${selected.state ? ', ' + selected.state : ''}` : ''}</p>
                <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                  {selected.website && <a href={selected.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-600 transition-colors"><Globe size={12}/>{selected.website.replace(/^https?:\/\//, '')}</a>}
                  {selected.accountManager && <span className="flex items-center gap-1"><UserCircle size={12}/> AM: {selected.accountManager}</span>}
                  {selected.convertedDate && <span className="flex items-center gap-1"><Calendar size={12}/> Client since {new Date(selected.convertedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </div>
              </div>
              {/* Revenue summary */}
              <div className="flex sm:flex-col gap-4 sm:gap-2 text-right flex-shrink-0">
                <div>
                  <p className="text-2xl font-black text-emerald-600">{fmt(selected.totalPaid || 0)}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Collected</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">{fmt(selected.totalRevenue || 0)}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Contract Value</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 border-b border-slate-200 overflow-x-auto pb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                )}
              >
                {tab.icon} {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Company Details */}
              <div className="lg:col-span-2 space-y-5">
                <SectionCard title="Company Information" icon={<Building2 size={15} className="text-blue-500" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {[
                      { label: 'Legal Name', value: selected.companyName },
                      { label: 'Industry', value: selected.industry || '—' },
                      { label: 'GSTIN', value: selected.gstin || '—', mono: true },
                      { label: 'PAN', value: selected.pan || '—', mono: true },
                      { label: 'Website', value: selected.website || '—', link: selected.website },
                      { label: 'Account Manager', value: selected.accountManager || '—' },
                    ].map(({ label, value, mono, link }) => (
                      <div key={label}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline flex items-center gap-1">{value}<ExternalLink size={11}/></a>
                        ) : (
                          <p className={clsx('font-semibold text-slate-800', mono && 'font-mono')}>{value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {(selected.address || selected.city) && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</p>
                      <p className="text-sm font-medium text-slate-700 flex items-start gap-1.5">
                        <MapPin size={13} className="text-slate-400 mt-0.5 flex-shrink-0" />
                        {[selected.address, selected.city, selected.state, selected.country].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </SectionCard>

                {selected.notes && (
                  <SectionCard title="Internal Notes" icon={<StickyNote size={15} className="text-amber-500" />}>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selected.notes}</p>
                  </SectionCard>
                )}
              </div>

              {/* Right side quick stats */}
              <div className="space-y-4">
                {/* Quick numbers */}
                {[
                  { label: 'Active Services', value: selected.services?.filter((s: any) => s.status === 'active').length || 0, color: 'text-blue-600', bg: 'bg-blue-50', icon: <Briefcase size={16}/> },
                  { label: 'Meetings Held', value: selected.meetingNotes?.length || 0, color: 'text-purple-600', bg: 'bg-purple-50', icon: <MessageSquare size={16}/> },
                  { label: 'Documents', value: selected.documents?.length || 0, color: 'text-slate-600', bg: 'bg-slate-50', icon: <FileText size={16}/> },
                  { label: 'Contacts', value: selected.contacts?.length || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <Users size={16}/> },
                ].map(({ label, value, color, bg, icon }) => (
                  <div key={label} className={clsx('glass-card p-4 border border-slate-200 flex items-center gap-3', bg)}>
                    <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', bg)}>
                      <span className={color}>{icon}</span>
                    </div>
                    <div>
                      <p className={clsx('text-xl font-black', color)}>{value}</p>
                      <p className="text-xs text-slate-500 font-medium">{label}</p>
                    </div>
                  </div>
                ))}

                {/* Tags */}
                {selected.tags?.length > 0 && (
                  <div className="glass-card p-4 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.tags.map((tag: string) => (
                        <span key={tag} className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CONTACTS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'contacts' && (
            <SectionCard
              title="Contact Persons"
              icon={<Users size={15} className="text-emerald-500" />}
              action={<button onClick={() => setShowAddContact(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={12}/> Add Contact</button>}
            >
              {!selected.contacts?.length ? (
                <EmptyState icon={<Users size={36}/>} text="No contacts added yet" cta={<button onClick={() => setShowAddContact(true)} className="btn-primary text-sm mt-2"><Plus size={13}/>Add Contact</button>} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selected.contacts.map((c: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors relative group">
                      <button onClick={() => deleteSub(`/contacts/${i}`, 'Contact removed')} className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <X size={13}/>
                      </button>
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(c.name)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                            {c.isPrimary && <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-wide">Primary</span>}
                          </div>
                          {c.designation && <p className="text-xs text-slate-500 mb-2">{c.designation}</p>}
                          <div className="space-y-1">
                            {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Mail size={11}/>{c.email}</a>}
                            {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-slate-600"><Phone size={11}/>{c.phone}</a>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── SERVICES TAB ─────────────────────────────────────────────── */}
          {activeTab === 'services' && (
            <SectionCard
              title="Services Purchased"
              icon={<Briefcase size={15} className="text-blue-500" />}
              action={<button onClick={() => setShowAddService(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={12}/> Add Service</button>}
            >
              {!selected.services?.length ? (
                <EmptyState icon={<Briefcase size={36}/>} text="No services recorded yet" cta={<button onClick={() => setShowAddService(true)} className="btn-primary text-sm mt-2"><Plus size={13}/>Add Service</button>} />
              ) : (
                <div className="space-y-3">
                  {selected.services.map((s: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors relative group">
                      <button onClick={() => deleteSub(`/services/${i}`, 'Service removed')} className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <X size={13}/>
                      </button>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-slate-900">{s.name}</p>
                            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', SERVICE_STATUS[s.status] || SERVICE_STATUS.active)}>{s.status}</span>
                          </div>
                          {s.description && <p className="text-xs text-slate-500 mb-2">{s.description}</p>}
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><Clock size={11}/>{s.billingCycle}</span>
                            {s.startDate && <span className="flex items-center gap-1"><Calendar size={11}/>From {s.startDate}</span>}
                            {s.endDate && <span>→ {s.endDate}</span>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-black text-slate-900">{fmt(s.amount)}</p>
                          <p className="text-[10px] text-slate-400">{s.currency}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-3 flex justify-between text-sm font-bold text-slate-700">
                    <span>Total Contract Value</span>
                    <span className="text-blue-600">{fmt(selected.totalRevenue || 0)}</span>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── PAYMENTS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'payments' && (
            <SectionCard
              title="Payment Records"
              icon={<CreditCard size={15} className="text-emerald-500" />}
              action={<button onClick={() => setShowAddPayment(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={12}/> Record Payment</button>}
            >
              {!selected.payments?.length ? (
                <EmptyState icon={<IndianRupee size={36}/>} text="No payments recorded yet" cta={<button onClick={() => setShowAddPayment(true)} className="btn-primary text-sm mt-2"><Plus size={13}/>Record Payment</button>} />
              ) : (
                <div className="space-y-3">
                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Total Collected', value: fmt(selected.payments.filter((p:any)=>p.status==='paid').reduce((a:number,p:any)=>a+p.amount,0)), color: 'text-emerald-600' },
                      { label: 'Pending', value: fmt(selected.payments.filter((p:any)=>p.status==='pending').reduce((a:number,p:any)=>a+p.amount,0)), color: 'text-amber-600' },
                      { label: 'Overdue', value: fmt(selected.payments.filter((p:any)=>p.status==='overdue').reduce((a:number,p:any)=>a+p.amount,0)), color: 'text-red-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                        <p className={clsx('font-black text-lg', color)}>{value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  {selected.payments.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                          <IndianRupee size={16} className="text-emerald-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{fmt(p.amount)}</p>
                            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', PAYMENT_STATUS[p.status] || PAYMENT_STATUS.paid)}>{p.status}</span>
                          </div>
                          <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                            <span>{new Date(p.date).toLocaleDateString('en-IN')}</span>
                            <span className="capitalize">{p.method.replace('_', ' ')}</span>
                            {p.reference && <span>Ref: {p.reference}</span>}
                          </div>
                          {p.notes && <p className="text-xs text-slate-400 mt-0.5">{p.notes}</p>}
                        </div>
                      </div>
                      <button onClick={() => deleteSub(`/payments/${i}`, 'Payment removed')} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <X size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── MEETINGS TAB ─────────────────────────────────────────────── */}
          {activeTab === 'meetings' && (
            <SectionCard
              title="Meeting Notes"
              icon={<MessageSquare size={15} className="text-purple-500" />}
              action={<button onClick={() => setShowAddMeeting(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={12}/> Add Note</button>}
            >
              {!selected.meetingNotes?.length ? (
                <EmptyState icon={<MessageSquare size={36}/>} text="No meeting notes yet" cta={<button onClick={() => setShowAddMeeting(true)} className="btn-primary text-sm mt-2"><Plus size={13}/>Add Meeting Note</button>} />
              ) : (
                <div className="space-y-4">
                  {selected.meetingNotes.map((m: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors relative group">
                      <button onClick={() => deleteSub(`/meetings/${i}`, 'Meeting note removed')} className="absolute top-3 right-3 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <X size={13}/>
                      </button>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-bold text-slate-900">{m.title}</h4>
                        <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap flex items-center gap-1 flex-shrink-0 mt-0.5">
                          <Calendar size={11}/>{new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {m.attendees && <p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Users size={11}/>Attendees: {m.attendees}</p>}
                      <p className="text-sm text-slate-700 leading-relaxed mb-3">{m.summary}</p>
                      {m.actionItems && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Action Items</p>
                          <p className="text-xs text-amber-800 whitespace-pre-wrap">{m.actionItems}</p>
                        </div>
                      )}
                      {m.nextMeetingDate && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1"><Calendar size={11}/>Next meeting: {new Date(m.nextMeetingDate).toLocaleDateString('en-IN')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── DOCUMENTS TAB ────────────────────────────────────────────── */}
          {activeTab === 'documents' && (
            <SectionCard
              title="Documents"
              icon={<FileText size={15} className="text-slate-500" />}
              action={<button onClick={() => setShowAddDoc(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={12}/> Add Document</button>}
            >
              {!selected.documents?.length ? (
                <EmptyState icon={<FileText size={36}/>} text="No documents attached yet" cta={<button onClick={() => setShowAddDoc(true)} className="btn-primary text-sm mt-2"><Plus size={13}/>Add Document</button>} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selected.documents.map((d: any, i: number) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-3 hover:border-slate-300 transition-colors group">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <FileText size={16} className="text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{d.name}</p>
                          <p className="text-xs text-slate-400 capitalize">{d.type} · {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('en-IN') : ''}</p>
                          {d.notes && <p className="text-xs text-slate-500 mt-1">{d.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={d.url} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View">
                          <Eye size={14}/>
                        </a>
                        <a href={d.url} download className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Download">
                          <Download size={14}/>
                        </a>
                        <button onClick={() => deleteSub(`/documents/${i}`, 'Document removed')} className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <X size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>

      ) : (
        /* ═══ LIST VIEW ══════════════════════════════════════════════════════ */
        <div className="space-y-5 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="page-title flex items-center gap-2">
                <Building2 className="text-blue-600" size={22} /> Client Management
              </h1>
              <p className="page-subtitle">Manage your agency clients — profiles, services, payments, and more</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button onClick={fetchClients} className="btn-secondary px-3 py-2" title="Refresh">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => setShowAddClient(true)} className="btn-primary">
                <Plus size={15} /> Add Client
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Clients', value: clients.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Building2 size={18}/> },
              { label: 'Active', value: clients.filter(c=>c.status==='active').length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <BadgeCheck size={18}/> },
              { label: 'Revenue Collected', value: fmt(totalRevenue), color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', icon: <TrendingUp size={18}/> },
              { label: 'On Hold / Churned', value: clients.filter(c=>c.status==='on-hold'||c.status==='churned').length, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertCircle size={18}/> },
            ].map(({ label, value, color, bg, border, icon }) => (
              <div key={label} className={`glass-card p-4 border ${border} ${bg} flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center ${color} flex-shrink-0`}>{icon}</div>
                <div>
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                  <p className="text-xs text-slate-500 font-medium">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="text" placeholder="Search clients..." value={search} onChange={e=>setSearch(e.target.value)} className="input-field pl-9 h-9 text-sm" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {['all', 'active', 'inactive', 'on-hold', 'churned'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border capitalize', filterStatus===s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Client Cards Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-blue-500" size={28} />
              <p className="text-sm text-slate-500">Loading clients...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center py-20 gap-3 border border-slate-200">
              <Building2 size={44} className="text-slate-300" />
              <p className="font-bold text-slate-600">No clients found</p>
              <p className="text-sm text-slate-400">{search || filterStatus !== 'all' ? 'Try a different search or filter' : 'Add your first client to get started'}</p>
              {(!search && filterStatus === 'all') && <button onClick={() => setShowAddClient(true)} className="btn-primary mt-2"><Plus size={14}/> Add Client</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(client => {
                const tier = TIERS[client.tier] || TIERS.standard
                return (
                  <button
                    key={client.id}
                    onClick={() => { setSelected(client); setActiveTab('overview') }}
                    className="glass-card p-5 border border-slate-200 hover:border-blue-300 hover:shadow-md text-left transition-all duration-200 group"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarColor(client.companyName)} flex items-center justify-center text-white font-black text-lg shadow-sm flex-shrink-0`}>
                        {client.companyName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">{client.companyName}</p>
                        {client.clientCode && <p className="text-[11px] text-slate-400 font-mono">#{client.clientCode}</p>}
                        <p className="text-xs text-slate-500 truncate">{client.industry}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', CLIENT_STATUS[client.status] || CLIENT_STATUS.active)}>{client.status}</span>
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', tier.color, tier.bg, tier.border)}>{tier.icon}{tier.label}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-100">
                      <div>
                        <p className="text-sm font-black text-slate-800">{client.contacts?.length || 0}</p>
                        <p className="text-[10px] text-slate-400">Contacts</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{client.services?.length || 0}</p>
                        <p className="text-[10px] text-slate-400">Services</p>
                      </div>
                      <div>
                        <p className="text-sm font-black text-emerald-600">{fmt(client.totalPaid || 0)}</p>
                        <p className="text-[10px] text-slate-400">Collected</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Add Client Modal */}
      {showAddClient && (
        <Modal title="Add New Client" subtitle="Convert a lead or add a new agency client" onClose={() => setShowAddClient(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Company Name *</label>
                <input className="input-field" placeholder="Acme Technologies" value={clientForm.companyName} onChange={e=>setClientForm((f:any)=>({...f,companyName:e.target.value}))}/>
              </div>
              <div>
                <label className="label">Client Code</label>
                <input className="input-field font-mono" placeholder="CLI-001" value={clientForm.clientCode} onChange={e=>setClientForm((f:any)=>({...f,clientCode:e.target.value}))}/>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Industry</label>
                <select className="select-field" value={clientForm.industry} onChange={e=>setClientForm((f:any)=>({...f,industry:e.target.value}))}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input-field" placeholder="https://acme.com" value={clientForm.website} onChange={e=>setClientForm((f:any)=>({...f,website:e.target.value}))}/>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">GSTIN</label>
                <input className="input-field font-mono" placeholder="27AABCU9603R1ZX" value={clientForm.gstin} onChange={e=>setClientForm((f:any)=>({...f,gstin:e.target.value}))}/>
              </div>
              <div>
                <label className="label">PAN</label>
                <input className="input-field font-mono" placeholder="AABCU9603R" value={clientForm.pan} onChange={e=>setClientForm((f:any)=>({...f,pan:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input-field" placeholder="123, MG Road, Bangalore" value={clientForm.address} onChange={e=>setClientForm((f:any)=>({...f,address:e.target.value}))}/>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">City</label>
                <input className="input-field" placeholder="Bangalore" value={clientForm.city} onChange={e=>setClientForm((f:any)=>({...f,city:e.target.value}))}/>
              </div>
              <div>
                <label className="label">State</label>
                <input className="input-field" placeholder="Karnataka" value={clientForm.state} onChange={e=>setClientForm((f:any)=>({...f,state:e.target.value}))}/>
              </div>
              <div>
                <label className="label">Country</label>
                <input className="input-field" placeholder="India" value={clientForm.country} onChange={e=>setClientForm((f:any)=>({...f,country:e.target.value}))}/>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Tier</label>
                <select className="select-field" value={clientForm.tier} onChange={e=>setClientForm((f:any)=>({...f,tier:e.target.value}))}>
                  {Object.entries(TIERS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select-field" value={clientForm.status} onChange={e=>setClientForm((f:any)=>({...f,status:e.target.value}))}>
                  {Object.keys(CLIENT_STATUS).map(s=><option key={s} value={s} className="capitalize">{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Account Manager</label>
                <input className="input-field" placeholder="Your name" value={clientForm.accountManager} onChange={e=>setClientForm((f:any)=>({...f,accountManager:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label className="label">Client Since</label>
              <input type="date" className="input-field" value={clientForm.convertedDate} onChange={e=>setClientForm((f:any)=>({...f,convertedDate:e.target.value}))}/>
            </div>
            <div>
              <label className="label">Internal Notes</label>
              <textarea className="textarea-field" rows={3} placeholder="Any important notes about this client..." value={clientForm.notes} onChange={e=>setClientForm((f:any)=>({...f,notes:e.target.value}))}/>
            </div>
          </div>
          <ModalFooter onCancel={() => setShowAddClient(false)} onSave={handleCreateClient} saving={saving} saveLabel="Add Client" />
        </Modal>
      )}

      {/* Edit Client Modal */}
      {showEditClient && (
        <Modal title="Edit Client" subtitle={selected?.companyName} onClose={() => setShowEditClient(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Company Name</label><input className="input-field" value={clientForm.companyName} onChange={e=>setClientForm((f:any)=>({...f,companyName:e.target.value}))}/></div>
              <div><label className="label">Industry</label><select className="select-field" value={clientForm.industry} onChange={e=>setClientForm((f:any)=>({...f,industry:e.target.value}))}><option value="">Select...</option>{INDUSTRIES.map(i=><option key={i}>{i}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Tier</label><select className="select-field" value={clientForm.tier} onChange={e=>setClientForm((f:any)=>({...f,tier:e.target.value}))}>{Object.entries(TIERS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label className="label">Status</label><select className="select-field" value={clientForm.status} onChange={e=>setClientForm((f:any)=>({...f,status:e.target.value}))}>{Object.keys(CLIENT_STATUS).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div><label className="label">Account Manager</label><input className="input-field" value={clientForm.accountManager||''} onChange={e=>setClientForm((f:any)=>({...f,accountManager:e.target.value}))}/></div>
            <div><label className="label">Website</label><input className="input-field" value={clientForm.website||''} onChange={e=>setClientForm((f:any)=>({...f,website:e.target.value}))}/></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="label">GSTIN</label><input className="input-field font-mono" value={clientForm.gstin||''} onChange={e=>setClientForm((f:any)=>({...f,gstin:e.target.value}))}/></div><div><label className="label">PAN</label><input className="input-field font-mono" value={clientForm.pan||''} onChange={e=>setClientForm((f:any)=>({...f,pan:e.target.value}))}/></div></div>
            <div><label className="label">Notes</label><textarea className="textarea-field" rows={3} value={clientForm.notes||''} onChange={e=>setClientForm((f:any)=>({...f,notes:e.target.value}))}/></div>
          </div>
          <ModalFooter onCancel={() => setShowEditClient(false)} onSave={handleUpdateClient} saving={saving} saveLabel="Save Changes" />
        </Modal>
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <Modal title="Add Contact Person" subtitle={selected?.companyName} onClose={() => setShowAddContact(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Full Name *</label><input className="input-field" placeholder="Rahul Sharma" value={contactForm.name} onChange={e=>setContactForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className="label">Designation</label><input className="input-field" placeholder="CEO / Founder" value={contactForm.designation} onChange={e=>setContactForm(f=>({...f,designation:e.target.value}))}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Email</label><input type="email" className="input-field" placeholder="rahul@company.com" value={contactForm.email} onChange={e=>setContactForm(f=>({...f,email:e.target.value}))}/></div>
              <div><label className="label">Phone</label><input className="input-field" placeholder="+91 98765 43210" value={contactForm.phone} onChange={e=>setContactForm(f=>({...f,phone:e.target.value}))}/></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={contactForm.isPrimary} onChange={e=>setContactForm(f=>({...f,isPrimary:e.target.checked}))}/>
              <span className="text-sm font-semibold text-slate-700">Mark as primary contact</span>
            </label>
          </div>
          <ModalFooter onCancel={() => setShowAddContact(false)} onSave={handleAddContact} saving={saving} saveLabel="Add Contact" />
        </Modal>
      )}

      {/* Add Service Modal */}
      {showAddService && (
        <Modal title="Add Service" subtitle={selected?.companyName} onClose={() => setShowAddService(false)}>
          <div className="space-y-4">
            <div><label className="label">Service Name *</label><input className="input-field" placeholder="Social Media Management" value={serviceForm.name} onChange={e=>setServiceForm(f=>({...f,name:e.target.value}))}/></div>
            <div><label className="label">Description</label><textarea className="textarea-field" rows={2} placeholder="What's included..." value={serviceForm.description} onChange={e=>setServiceForm(f=>({...f,description:e.target.value}))}/></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Amount (₹) *</label><input type="number" className="input-field" placeholder="25000" value={serviceForm.amount} onChange={e=>setServiceForm(f=>({...f,amount:e.target.value}))}/></div>
              <div><label className="label">Billing Cycle</label><select className="select-field" value={serviceForm.billingCycle} onChange={e=>setServiceForm(f=>({...f,billingCycle:e.target.value}))}>{BILLING_CYCLES.map(b=><option key={b} value={b} className="capitalize">{b}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Start Date</label><input type="date" className="input-field" value={serviceForm.startDate} onChange={e=>setServiceForm(f=>({...f,startDate:e.target.value}))}/></div>
              <div><label className="label">End Date</label><input type="date" className="input-field" value={serviceForm.endDate} onChange={e=>setServiceForm(f=>({...f,endDate:e.target.value}))}/></div>
            </div>
            <div><label className="label">Status</label><select className="select-field" value={serviceForm.status} onChange={e=>setServiceForm(f=>({...f,status:e.target.value}))}>{Object.keys(SERVICE_STATUS).map(s=><option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
          </div>
          <ModalFooter onCancel={() => setShowAddService(false)} onSave={handleAddService} saving={saving} saveLabel="Add Service" />
        </Modal>
      )}

      {/* Record Payment Modal */}
      {showAddPayment && (
        <Modal title="Record Payment" subtitle={selected?.companyName} onClose={() => setShowAddPayment(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Amount (₹) *</label><input type="number" className="input-field" placeholder="50000" value={paymentForm.amount} onChange={e=>setPaymentForm(f=>({...f,amount:e.target.value}))}/></div>
              <div><label className="label">Date</label><input type="date" className="input-field" value={paymentForm.date} onChange={e=>setPaymentForm(f=>({...f,date:e.target.value}))}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Payment Method</label><select className="select-field" value={paymentForm.method} onChange={e=>setPaymentForm(f=>({...f,method:e.target.value}))}>{PAYMENT_METHODS.map(m=><option key={m} value={m} className="capitalize">{m.replace('_',' ')}</option>)}</select></div>
              <div><label className="label">Status</label><select className="select-field" value={paymentForm.status} onChange={e=>setPaymentForm(f=>({...f,status:e.target.value}))}>{Object.keys(PAYMENT_STATUS).map(s=><option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
            </div>
            <div><label className="label">Reference / Transaction ID</label><input className="input-field font-mono" placeholder="TXN123456789" value={paymentForm.reference} onChange={e=>setPaymentForm(f=>({...f,reference:e.target.value}))}/></div>
            <div><label className="label">Notes</label><input className="input-field" placeholder="Invoice #001, Q1 retainer..." value={paymentForm.notes} onChange={e=>setPaymentForm(f=>({...f,notes:e.target.value}))}/></div>
          </div>
          <ModalFooter onCancel={() => setShowAddPayment(false)} onSave={handleAddPayment} saving={saving} saveLabel="Record Payment" />
        </Modal>
      )}

      {/* Add Meeting Note Modal */}
      {showAddMeeting && (
        <Modal title="Add Meeting Note" subtitle={selected?.companyName} onClose={() => setShowAddMeeting(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Meeting Title *</label><input className="input-field" placeholder="Monthly Review Call" value={meetingForm.title} onChange={e=>setMeetingForm(f=>({...f,title:e.target.value}))}/></div>
              <div><label className="label">Date</label><input type="date" className="input-field" value={meetingForm.date} onChange={e=>setMeetingForm(f=>({...f,date:e.target.value}))}/></div>
            </div>
            <div><label className="label">Attendees</label><input className="input-field" placeholder="Rahul Sharma, Priya (AM), Vikram (Design)" value={meetingForm.attendees} onChange={e=>setMeetingForm(f=>({...f,attendees:e.target.value}))}/></div>
            <div><label className="label">Meeting Summary *</label><textarea className="textarea-field" rows={4} placeholder="Discussed campaign performance, client feedback, upcoming deliverables..." value={meetingForm.summary} onChange={e=>setMeetingForm(f=>({...f,summary:e.target.value}))}/></div>
            <div><label className="label">Action Items</label><textarea className="textarea-field" rows={3} placeholder="1. Send revised proposal by Friday&#10;2. Schedule design review" value={meetingForm.actionItems} onChange={e=>setMeetingForm(f=>({...f,actionItems:e.target.value}))}/></div>
            <div><label className="label">Next Meeting Date</label><input type="date" className="input-field" value={meetingForm.nextMeetingDate} onChange={e=>setMeetingForm(f=>({...f,nextMeetingDate:e.target.value}))}/></div>
          </div>
          <ModalFooter onCancel={() => setShowAddMeeting(false)} onSave={handleAddMeeting} saving={saving} saveLabel="Save Meeting Note" />
        </Modal>
      )}

      {/* Add Document Modal */}
      {showAddDoc && (
        <Modal title="Add Document" subtitle={selected?.companyName} onClose={() => setShowAddDoc(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Document Name *</label><input className="input-field" placeholder="Service Agreement 2025" value={docForm.name} onChange={e=>setDocForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className="label">Type</label><select className="select-field" value={docForm.type} onChange={e=>setDocForm(f=>({...f,type:e.target.value}))}>{DOC_TYPES.map(t=><option key={t} value={t} className="capitalize">{t}</option>)}</select></div>
            </div>
            <div>
              <label className="label">Upload File</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-300 transition-colors cursor-pointer" onClick={() => document.getElementById('doc-upload')?.click()}>
                <UploadCloud size={24} className="mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">{docFile ? docFile.name : 'Click to upload a file'}</p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, PNG, JPG — max 20MB</p>
                <input id="doc-upload" type="file" className="hidden" onChange={e => setDocFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div>
              <label className="label">Or Paste URL</label>
              <input className="input-field" placeholder="https://drive.google.com/..." value={docForm.url} onChange={e=>setDocForm(f=>({...f,url:e.target.value}))}/>
            </div>
            <div><label className="label">Notes</label><input className="input-field" placeholder="Signed on 15 June 2025..." value={docForm.notes} onChange={e=>setDocForm(f=>({...f,notes:e.target.value}))}/></div>
          </div>
          <ModalFooter onCancel={() => setShowAddDoc(false)} onSave={handleAddDoc} saving={saving || docUploading} saveLabel={docUploading ? 'Uploading...' : 'Add Document'} />
        </Modal>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 text-center animate-slide-up border-slate-200">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto"><Trash2 size={24} className="text-red-500"/></div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Delete Client?</h3>
              <p className="text-sm text-slate-500 mt-1"><strong>{selected?.companyName}</strong> and all associated data (contacts, services, payments, documents) will be permanently removed.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDeleteClient} className="btn-danger flex-1 bg-red-500 text-white hover:bg-red-600 border-red-500"><Trash2 size={14}/> Delete</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

// ── Reusable Modal wrapper ─────────────────────────────────────────────────────
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-xl border-slate-200 animate-slide-up max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"><X size={18}/></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  )
}

function ModalFooter({ onCancel, onSave, saving, saveLabel }: { onCancel: () => void; onSave: () => void; saving: boolean; saveLabel: string }) {
  return (
    <div className="flex gap-3 justify-end pt-5 border-t border-slate-100 mt-5">
      <button onClick={onCancel} className="btn-secondary">Cancel</button>
      <button onClick={onSave} disabled={saving} className="btn-primary">
        {saving ? <><Loader2 size={14} className="animate-spin"/> Saving...</> : <><Plus size={14}/>{saveLabel}</>}
      </button>
    </div>
  )
}
