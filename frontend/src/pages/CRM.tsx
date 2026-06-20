import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { Lead, LeadStatus, LeadSource } from '../types'
import {
  Plus, Search, LayoutGrid, List, Trash2,
  Phone, Mail, Edit3, X, ChevronDown, Upload,
  MessageCircle, Filter, Download, RefreshCw, Users, ClipboardList
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import KanbanBoard from '../components/KanbanBoard'
import EditableCell from '../components/EditableCell'
import LeadActivityPanel from '../components/LeadActivityPanel'

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Closed', 'Lost']
const SOURCES: LeadSource[] = ['Facebook Ads', 'Instagram Ads', 'WhatsApp', 'Website', 'Referral', 'Walk-in', 'Other']

const STATUS_STYLE: Record<LeadStatus, string> = {
  New: 'badge-new',
  Contacted: 'badge-contacted',
  Qualified: 'badge-qualified',
  Closed: 'badge-closed',
  Lost: 'badge-lost',
}

const KANBAN_COLS: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Closed']
const KANBAN_COLORS: Record<string, string> = {
  New: 'border-slate-600',
  Contacted: 'border-sky-500/50',
  Qualified: 'border-violet-500/50',
  Closed: 'border-emerald-500/50',
}

const EMPTY_FORM = {
  fullName: '', email: '', phone: '', companyName: '',
  leadSource: 'Website' as LeadSource, serviceInterested: '',
  status: 'New' as LeadStatus, notes: '',
}

export default function CRM() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      toast.success('Leads data refreshed')
    }, 600)
  }
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'All'>('All')
  const [filterSource, setFilterSource] = useState<string>('All')
  const [showModal, setShowModal] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [activityLead, setActivityLead] = useState<Lead | null>(null)

  // ── Fetch Leads ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'leads'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)))
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  // ── Lead Selection State ───────────────────────────
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  function handleToggleSelect(id: string) {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  function handleToggleSelectAll(filteredLeads: Lead[]) {
    const filteredIds = filteredLeads.map(l => l.id)
    const allSelected = filteredIds.every(id => selectedLeadIds.includes(id))
    if (allSelected) {
      setSelectedLeadIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      setSelectedLeadIds(prev => {
        const union = new Set([...prev, ...filteredIds])
        return Array.from(union)
      })
    }
  }

  // ── Import Leads State & Handlers ──────────────────
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [parsedLeads, setParsedLeads] = useState<any[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/)
    if (lines.length < 2) throw new Error('CSV is empty or missing header/data')

    // Parse headers and trim any surrounding spaces/quotes
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase())

    const results = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Simple CSV parser that handles optional quotes
      const values: string[] = []
      let current = ''
      let inQuotes = false
      for (let j = 0; j < line.length; j++) {
        const char = line[j]
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())

      const record: any = {}
      headers.forEach((header, index) => {
        const val = values[index]?.replace(/^["']|["']$/g, '').trim() || ''
        if (header.includes('name')) record.fullName = val
        else if (header === 'email') record.email = val
        else if (header === 'phone') record.phone = val
        else if (header.includes('company')) record.companyName = val
        else if (header.includes('source')) record.leadSource = val
        else if (header.includes('service') || header.includes('interest')) record.serviceInterested = val
        else if (header === 'status') record.status = val
        else if (header === 'notes') record.notes = val
      })

      if (!record.fullName && !record.phone) continue // skip empty records

      record.fullName = record.fullName || 'Unnamed Lead'
      record.phone = record.phone || ''
      record.email = record.email || ''
      record.companyName = record.companyName || ''
      record.serviceInterested = record.serviceInterested || ''
      record.notes = record.notes || ''

      // Map and validate source
      const sourceMap: Record<string, LeadSource> = {
        'facebook ads': 'Facebook Ads',
        'facebook': 'Facebook Ads',
        'instagram ads': 'Instagram Ads',
        'instagram': 'Instagram Ads',
        'whatsapp': 'WhatsApp',
        'website': 'Website',
        'referral': 'Referral',
        'walk-in': 'Walk-in',
        'walkin': 'Walk-in',
        'other': 'Other'
      }
      const sLower = (record.leadSource || '').toLowerCase()
      record.leadSource = sourceMap[sLower] || 'Website'

      // Map and validate status
      const statusMap: Record<string, LeadStatus> = {
        'new': 'New',
        'contacted': 'Contacted',
        'qualified': 'Qualified',
        'closed': 'Closed',
        'lost': 'Lost'
      }
      const stLower = (record.status || '').toLowerCase()
      record.status = statusMap[stLower] || 'New'

      results.push(record)
    }

    return results
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    setImportError(null)
    setParsedLeads([])

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.length === 0) {
          throw new Error('No valid leads found in CSV. Make sure you have "Name" and "Phone" columns.')
        }
        setParsedLeads(parsed)
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse CSV file')
        toast.error(err.message || 'Failed to parse CSV file')
      }
    }
    reader.onerror = () => {
      setImportError('Error reading CSV file')
      toast.error('Error reading CSV file')
    }
    reader.readAsText(file)
  }

  async function confirmImport() {
    if (parsedLeads.length === 0 || !currentUser) return
    setImporting(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const lead of parsedLeads) {
        try {
          const payload = {
            fullName: lead.fullName,
            phone: lead.phone,
            email: lead.email,
            companyName: lead.companyName,
            leadSource: lead.leadSource,
            serviceInterested: lead.serviceInterested,
            status: lead.status,
            notes: lead.notes,
            userId: currentUser.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          await addDoc(collection(db, 'leads'), payload)
          successCount++
        } catch (err) {
          console.error('Error importing lead:', err)
          failCount++
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} leads!`)
      }
      if (failCount > 0) {
        toast.error(`Failed to import ${failCount} leads.`)
      }

      setShowImportModal(false)
      setImportFile(null)
      setParsedLeads([])
      setImportError(null)
    } catch (err) {
      toast.error('An error occurred during import')
    } finally {
      setImporting(false)
    }
  }

  function downloadSampleCSV() {
    const header = ['Name', 'Email', 'Phone', 'Company', 'Source', 'Service', 'Status', 'Notes']
    const sampleRows = [
      ['Rahul Sharma', 'rahul@example.com', '9876543210', 'Acme Corp', 'Facebook Ads', 'WhatsApp Marketing', 'New', 'Interested in bulk pricing'],
      ['Priya Nair', 'priya@example.com', '9123456789', 'TechSolutions', 'WhatsApp', 'SEO Services', 'Contacted', 'Follow up next Tuesday']
    ]
    const csvContent = [header, ...sampleRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tpcrm_leads_sample.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded sample CSV template!')
  }

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'leads'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)))
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  function openAdd() {
    setEditLead(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(lead: Lead) {
    setEditLead(lead)
    setForm({
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      companyName: lead.companyName || '',
      leadSource: lead.leadSource,
      serviceInterested: lead.serviceInterested,
      status: lead.status,
      notes: lead.notes || '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.fullName || !form.phone) return toast.error('Name and phone are required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        userId: currentUser!.uid,
        updatedAt: new Date().toISOString(),
      }
      if (editLead) {
        await updateDoc(doc(db, 'leads', editLead.id), payload)
        toast.success('Lead updated!')
      } else {
        await addDoc(collection(db, 'leads'), {
          ...payload,
          createdAt: new Date().toISOString(),
        })
        toast.success('Lead added!')
      }
      setShowModal(false)
    } catch {
      toast.error('Failed to save lead')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lead?')) return
    try {
      await deleteDoc(doc(db, 'leads', id))
      toast.success('Lead deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  async function updateStatus(id: string, status: LeadStatus) {
    await updateDoc(doc(db, 'leads', id), { status, updatedAt: new Date().toISOString() })
    toast.success(`Moved to ${status}`)
  }

  async function handleUpdateField(id: string, field: keyof Lead, value: string) {
    try {
      await updateDoc(doc(db, 'leads', id), { [field]: value, updatedAt: new Date().toISOString() })
    } catch {
      toast.error('Failed to update field')
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedLeadIds.length} leads?`)) return
    setSaving(true)
    try {
      for (const id of selectedLeadIds) {
        await deleteDoc(doc(db, 'leads', id))
      }
      toast.success(`Deleted ${selectedLeadIds.length} leads`)
      setSelectedLeadIds([])
    } catch {
      toast.error('Failed to delete some leads')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkStatusChange(newStatus: LeadStatus) {
    setSaving(true)
    try {
      for (const id of selectedLeadIds) {
        await updateDoc(doc(db, 'leads', id), { status: newStatus, updatedAt: new Date().toISOString() })
      }
      toast.success(`Updated ${selectedLeadIds.length} leads to ${newStatus}`)
      setSelectedLeadIds([])
    } catch {
      toast.error('Failed to update some leads')
    } finally {
      setSaving(false)
    }
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.fullName?.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q) || l.companyName?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'All' || l.status === filterStatus
    const matchSource = filterSource === 'All' || l.leadSource === filterSource || (filterSource === 'Meta' && (l.leadSource === 'Facebook Ads' || l.leadSource === 'Instagram Ads'))
    return matchSearch && matchStatus && matchSource
  })

  function exportCSV() {
    const header = ['Name', 'Email', 'Phone', 'Company', 'Source', 'Service', 'Status', 'Notes', 'Created']
    const rows = filtered.map(l => [l.fullName, l.email, l.phone, l.companyName || '', l.leadSource, l.serviceInterested, l.status, l.notes || '', l.createdAt])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
  }

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-black tracking-tight">Leads Pipeline</h1>
            <p className="text-sm text-black opacity-60 font-medium mt-1">Manage and track your incoming leads</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRefresh} className="btn-secondary px-3">
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={exportCSV} className="btn-secondary">
              <Download size={15} /> Export CSV
            </button>
            <button onClick={() => setShowImportModal(true)} className="btn-secondary hidden sm:flex">
              <Upload size={15} /> Import
            </button>
            <button
              onClick={() => {
                setEditLead(null)
                setForm(EMPTY_FORM)
                setShowModal(true)
              }}
              className="btn-primary"
            >
              <Plus size={15} /> Add Lead
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-10"
              id="lead-search"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as LeadStatus | 'All')}
              className="select-field pl-10 pr-8 min-w-[140px]"
            >
              <option value="All">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Source filter */}
          <div className="relative">
            <select
              value={filterSource}
              onChange={e => setFilterSource(e.target.value)}
              className="select-field pr-8 min-w-[140px]"
            >
              <option value="All">All Sources</option>
              <option value="Meta">📱 Meta (FB + IG)</option>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => setView('table')}
              className={clsx('px-4 py-2.5 flex items-center gap-2 text-sm font-medium transition-colors', view === 'table' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50')}
            >
              <List size={15} /> Table
            </button>
            <button
              onClick={() => setView('kanban')}
              className={clsx('px-4 py-2.5 flex items-center gap-2 text-sm font-medium transition-colors', view === 'kanban' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50')}
            >
              <LayoutGrid size={15} /> Kanban
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === 'table' ? (
          <TableView
            leads={filtered}
            onEdit={openEdit}
            onDelete={handleDelete}
            onStatusChange={updateStatus}
            onUpdateField={handleUpdateField}
            onActivity={(lead) => setActivityLead(lead)}
            selectedLeadIds={selectedLeadIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={() => handleToggleSelectAll(filtered)}
          />
        ) : (
          <KanbanBoard leads={filtered} onEdit={openEdit} onDelete={handleDelete} onStatusChange={updateStatus} onActivity={(lead: Lead) => setActivityLead(lead)} />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg p-6 space-y-5 animate-slide-up border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 font-display">
                {editLead ? 'Edit Lead' : 'Add New Lead'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="label">Full Name *</label>
                <input className="input-field" placeholder="Rahul Sharma" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label">Phone *</label>
                <input className="input-field" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label">Email</label>
                <input className="input-field" type="email" placeholder="rahul@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label">Company</label>
                <input className="input-field" placeholder="Acme Corp" value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div>
                <label className="label">Lead Source</label>
                <select className="select-field" value={form.leadSource} onChange={e => setForm(f => ({ ...f, leadSource: e.target.value as LeadSource }))}>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select-field" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Service Interested</label>
                <input className="input-field" placeholder="e.g. WhatsApp Marketing, SEO..." value={form.serviceInterested} onChange={e => setForm(f => ({ ...f, serviceInterested: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input-field resize-none" rows={3} placeholder="Any additional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editLead ? 'Update Lead' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Panel */}
      {activityLead && (
        <LeadActivityPanel
          lead={activityLead}
          onClose={() => setActivityLead(null)}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-xl backdrop-blur-md animate-slide-up">
          <div className="text-sm font-semibold text-slate-800">
            <span className="text-blue-600">{selectedLeadIds.length}</span> leads selected
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-3">
            {selectedLeadIds.length === 1 ? (
              <>
                <button
                  onClick={() => {
                    const lead = leads.find(l => l.id === selectedLeadIds[0])
                    if (lead) {
                      navigate(`/livechat?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.fullName)}`)
                    }
                  }}
                  className="btn-primary text-xs py-2 px-3.5"
                >
                  <MessageCircle size={13} /> Open Live Chat
                </button>
                <button
                  onClick={() => {
                    const lead = leads.find(l => l.id === selectedLeadIds[0])
                    if (lead) {
                      navigate(`/whatsapp?phone=${encodeURIComponent(lead.phone)}&name=${encodeURIComponent(lead.fullName)}`)
                    }
                  }}
                  className="btn-success text-xs py-2 px-3.5"
                >
                  <Phone size={13} /> WhatsApp Chat
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  const selectedLeads = leads.filter(l => selectedLeadIds.includes(l.id))
                  const phones = selectedLeads.map(l => l.phone).join(',')
                  navigate(`/whatsapp?broadcast=${encodeURIComponent(phones)}`)
                }}
                className="btn-primary text-xs py-2 px-3.5"
              >
                <MessageCircle size={13} /> Broadcast WhatsApp
              </button>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <div className="relative group">
              <button className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-2">
                <Edit3 size={13} /> Edit Status <ChevronDown size={12} />
              </button>
              <div className="absolute bottom-full left-0 mb-2 w-36 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden hidden group-hover:block transition-all z-50">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => handleBulkStatusChange(s)}
                    className="block w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Move to {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleBulkDelete}
              className="btn-danger text-xs py-2 px-3.5"
            >
              <Trash2 size={13} /> Delete
            </button>

            <button
              onClick={() => setSelectedLeadIds([])}
              className="text-xs py-2 px-3.5 text-slate-500 hover:text-slate-800 transition-colors font-medium ml-2"
            >
              <X size={13} className="inline mr-1" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-xl p-6 space-y-5 animate-slide-up border-slate-200 shadow-2xl relative overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="text-blue-700" size={18} />
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  Import Leads from CSV
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportFile(null)
                  setParsedLeads([])
                  setImportError(null)
                }}
                className="text-slate-500 hover:text-slate-900 transition-colors"
                disabled={importing}
              >
                <X size={20} />
              </button>
            </div>

            {/* Explanation / Sample Download */}
            <div className="bg-white/50 rounded-xl p-4 border border-slate-200 text-xs text-slate-500 space-y-2">
              <p className="font-semibold text-slate-700">CSV Columns Supported:</p>
              <p className="leading-relaxed">
                <code className="text-sky-300 font-mono">Name</code> (Required),
                <code className="text-sky-300 font-mono"> Phone</code> (Required),
                <code className="text-sky-300 font-mono"> Email</code>,
                <code className="text-sky-300 font-mono"> Company</code>,
                <code className="text-sky-300 font-mono"> Source</code>,
                <code className="text-sky-300 font-mono"> Service</code>,
                <code className="text-sky-300 font-mono"> Status</code>,
                <code className="text-sky-300 font-mono"> Notes</code>
              </p>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-2 gap-2 border-t border-slate-200">
                <span>Headers must match the names listed above.</span>
                <button
                  onClick={downloadSampleCSV}
                  type="button"
                  className="text-blue-700 hover:text-sky-300 font-semibold flex items-center gap-1.5 transition-colors hover:underline"
                >
                  <Download size={13} /> Sample CSV Template
                </button>
              </div>
            </div>

            {/* Drag and Drop / Input Area */}
            {!importFile ? (
              <div className="border-2 border-dashed border-slate-200 hover:border-sky-500/50 rounded-xl p-8 flex flex-col items-center justify-center transition-all bg-white/20 cursor-pointer relative group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload size={32} className="text-slate-500 group-hover:text-blue-700 mb-3 transition-colors duration-250" />
                <p className="text-sm font-semibold text-slate-200">Select or drag CSV file here</p>
                <p className="text-xs text-slate-500 mt-1">Supports CSV files up to 5MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File info */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-sky-500/10 rounded-lg flex items-center justify-center text-blue-700 flex-shrink-0">
                      <Upload size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{importFile.name}</p>
                      <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  {!importing && (
                    <button
                      onClick={() => {
                        setImportFile(null)
                        setParsedLeads([])
                        setImportError(null)
                      }}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Remove file"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Parsing Status */}
                {importError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-red-400">
                    <X size={15} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Failed to Import</p>
                      <p className="mt-0.5 text-slate-500">{importError}</p>
                    </div>
                  </div>
                )}

                {parsedLeads.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        ✓ Parsed {parsedLeads.length} leads successfully
                      </span>
                      <span className="text-slate-500">Previewing first 3 rows</span>
                    </div>

                    {/* Preview Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[160px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</th>
                            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700 bg-white/10">
                          {parsedLeads.slice(0, 3).map((lead, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-medium text-slate-900">{lead.fullName}</td>
                              <td className="px-3 py-2 text-blue-700 font-mono">{lead.phone || '—'}</td>
                              <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{lead.email || '—'}</td>
                              <td className="px-3 py-2 text-slate-500">{lead.leadSource}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end border-t border-slate-200 pt-4">
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportFile(null)
                  setParsedLeads([])
                  setImportError(null)
                }}
                className="btn-secondary"
                disabled={importing}
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importing || parsedLeads.length === 0}
                className="btn-primary"
              >
                {importing ? (
                  <>Importing...</>
                ) : (
                  <>Import {parsedLeads.length} Leads</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

// ─────────────────────────────────────────────
// Table View
// ─────────────────────────────────────────────
function TableView({
  leads, onEdit, onDelete, onStatusChange, onUpdateField, onActivity,
  selectedLeadIds, onToggleSelect, onToggleSelectAll
}: {
  leads: Lead[]
  onEdit: (l: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: LeadStatus) => void
  onUpdateField: (id: string, field: keyof Lead, value: string) => void
  onActivity: (l: Lead) => void
  selectedLeadIds: string[]
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
}) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  if (leads.length === 0) return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <List size={28} className="text-slate-400" />
      </div>
      <p className="font-bold text-slate-700">No leads found</p>
      <p className="text-sm text-slate-400 mt-1">Try adjusting your search or add a new lead</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100/60 border-b-2 border-slate-200">
              <th className="px-4 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && leads.every(l => selectedLeadIds.includes(l.id))}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />
              </th>
              {['Lead', 'Phone', 'Email', 'Source', 'Service', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3.5 text-left text-[11px] font-extrabold text-black uppercase tracking-widest whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, i) => (
              <tr
                key={lead.id}
                className={clsx(
                  'group relative transition-colors duration-150 border-b border-slate-100 last:border-0',
                  selectedLeadIds.includes(lead.id)
                    ? 'bg-blue-50/60'
                    : 'bg-white hover:bg-slate-50/80',
                  openDropdown === lead.id && 'z-[50]'
                )}
              >
                {/* Checkbox */}
                <td className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedLeadIds.includes(lead.id)}
                    onChange={() => onToggleSelect(lead.id)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                  />
                </td>

                {/* Name + company */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm shadow-blue-500/30">
                      {lead.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-black text-sm leading-tight">
                        <EditableCell value={lead.fullName} onSave={v => onUpdateField(lead.id, 'fullName', v)} placeholder="Name" />
                      </div>
                      <div className="text-xs text-black opacity-80 font-semibold mt-0.5">
                        <EditableCell value={lead.companyName || ''} onSave={v => onUpdateField(lead.id, 'companyName', v)} placeholder="Company" />
                      </div>
                    </div>
                  </div>
                </td>

                {/* Phone */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Phone size={11} className="text-blue-600" />
                    </div>
                    <div className="text-black font-semibold text-[13px]">
                      <EditableCell value={lead.phone} onSave={v => onUpdateField(lead.id, 'phone', v)} placeholder="Phone" />
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="px-4 py-4 max-w-[160px]">
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Mail size={11} className="text-violet-600" />
                    </div>
                    <div className="text-black font-medium text-[13px] flex-1 min-w-0">
                      <EditableCell value={lead.email || ''} onSave={v => onUpdateField(lead.id, 'email', v)} placeholder="Email" />
                    </div>
                  </div>
                </td>

                {/* Source */}
                <td className="px-4 py-4">
                  {(() => {
                    const src = lead.leadSource || ''
                    const srcStyles: Record<string, string> = {
                      'Facebook Ads': 'bg-blue-100 text-blue-700 border-blue-200',
                      'Instagram Ads': 'bg-pink-100 text-pink-700 border-pink-200',
                      'WhatsApp': 'bg-emerald-100 text-emerald-700 border-emerald-200',
                      'Website': 'bg-violet-100 text-violet-700 border-violet-200',
                      'Referral': 'bg-amber-100 text-amber-700 border-amber-200',
                      'Walk-in': 'bg-orange-100 text-orange-700 border-orange-200',
                      'Other': 'bg-slate-100 text-slate-600 border-slate-200',
                    }
                    const style = srcStyles[src] || srcStyles['Other']
                    return (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border ${style}`}>
                        {src}
                      </span>
                    )
                  })()}
                </td>

                {/* Service */}
                <td className="px-4 py-4 max-w-[150px]">
                  <div className="text-black font-medium text-[13px]">
                    <EditableCell value={lead.serviceInterested || ''} onSave={v => onUpdateField(lead.id, 'serviceInterested', v)} placeholder="Service" />
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-4">
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === lead.id ? null : lead.id)}
                      className={clsx(STATUS_STYLE[lead.status], 'cursor-pointer flex items-center gap-1.5 hover:opacity-90 transition-all hover:scale-105 active:scale-95')}
                    >
                      {lead.status}
                      <ChevronDown size={10} className="opacity-70" />
                    </button>
                    {openDropdown === lead.id && (
                      <div className="absolute z-[99] top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 min-w-[140px]">
                        {STATUSES.map(s => (
                          <button
                            key={s}
                            onClick={() => { onStatusChange(lead.id, s); setOpenDropdown(null) }}
                            className={clsx(
                              'w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-2',
                              s === lead.status
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            <span className={clsx(
                              'w-1.5 h-1.5 rounded-full flex-shrink-0',
                              s === 'New' ? 'bg-slate-400' :
                                s === 'Contacted' ? 'bg-blue-500' :
                                  s === 'Qualified' ? 'bg-violet-500' :
                                    s === 'Closed' ? 'bg-emerald-500' : 'bg-red-500'
                            )} />
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>

                {/* Actions — always partially visible, fully visible on hover */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-150 hover:scale-105 active:scale-95"
                      title="Open WhatsApp"
                    >
                      <MessageCircle size={13} />
                    </a>
                    <button
                      onClick={() => onActivity(lead)}
                      className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all duration-150 hover:scale-105 active:scale-95"
                      title="Activities & Meetings"
                    >
                      <ClipboardList size={13} />
                    </button>
                    <button
                      onClick={() => onEdit(lead)}
                      className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-150 hover:scale-105 active:scale-95"
                      title="Edit"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(lead.id)}
                      className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-150 hover:scale-105 active:scale-95"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
