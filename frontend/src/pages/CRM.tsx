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
  MessageCircle, Filter, Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

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
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'All'>('All')
  const [showModal, setShowModal] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
    return matchSearch && matchStatus
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="page-title">CRM Leads</h1>
            <p className="page-subtitle">{filtered.length} of {leads.length} leads</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={exportCSV} className="btn-secondary">
              <Download size={15} /> Export CSV
            </button>
            <button onClick={() => setShowImportModal(true)} className="btn-secondary">
              <Upload size={15} /> Import
            </button>
            <button onClick={openAdd} className="btn-primary" id="add-lead-btn">
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
            selectedLeadIds={selectedLeadIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={() => handleToggleSelectAll(filtered)}
          />
        ) : (
          <KanbanView leads={filtered} onEdit={openEdit} onDelete={handleDelete} onStatusChange={updateStatus} />
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
  leads, onEdit, onDelete, onStatusChange,
  selectedLeadIds, onToggleSelect, onToggleSelectAll
}: {
  leads: Lead[]
  onEdit: (l: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: LeadStatus) => void
  selectedLeadIds: string[]
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
}) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  if (leads.length === 0) return (
    <div className="glass-card flex flex-col items-center justify-center h-64 text-slate-500">
      <List size={36} className="mb-3 opacity-30" />
      <p className="font-medium">No leads found</p>
      <p className="text-sm mt-1">Try adjusting your search or add a new lead</p>
    </div>
  )

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className="px-4 py-3.5 text-left w-10">
                <input 
                  type="checkbox" 
                  checked={leads.length > 0 && leads.every(l => selectedLeadIds.includes(l.id))}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-200 bg-white text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                />
              </th>
              {['Name', 'Phone', 'Email', 'Source', 'Service', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {leads.map(lead => (
              <tr key={lead.id} className={clsx('hover:bg-slate-50 transition-colors group relative', selectedLeadIds.includes(lead.id) && 'bg-slate-50', openDropdown === lead.id && 'z-[50]')}>
                <td className="px-4 py-3.5 w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedLeadIds.includes(lead.id)}
                    onChange={() => onToggleSelect(lead.id)}
                    className="rounded border-slate-200 bg-white text-blue-500 focus:ring-blue-500/20 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                      {lead.fullName?.charAt(0) ?? '?'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{lead.fullName}</p>
                      {lead.companyName && <p className="text-xs text-slate-500">{lead.companyName}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-blue-700 hover:text-sky-300 transition-colors">
                    <Phone size={13} />
                    {lead.phone}
                  </a>
                </td>
                <td className="px-4 py-3.5">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-slate-500 hover:text-blue-700 transition-colors truncate max-w-[180px]">
                      <Mail size={13} />
                      {lead.email}
                    </a>
                  ) : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-700">
                    {lead.leadSource}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-slate-500 max-w-[160px] truncate">{lead.serviceInterested || '—'}</td>
                <td className="px-4 py-3.5">
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === lead.id ? null : lead.id)}
                      className={clsx(STATUS_STYLE[lead.status], 'cursor-pointer flex items-center gap-1 hover:opacity-80 transition-opacity')}
                    >
                      {lead.status}
                      <ChevronDown size={11} />
                    </button>
                    {openDropdown === lead.id && (
                      <div className="absolute z-[99] top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 min-w-[130px]">
                        {STATUSES.map(s => (
                          <button
                            key={s}
                            onClick={() => { onStatusChange(lead.id, s); setOpenDropdown(null) }}
                            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-700 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Open WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </a>
                    <button onClick={() => onEdit(lead)} className="p-1.5 rounded-lg text-blue-700 hover:bg-sky-500/10 transition-colors" title="Edit">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => onDelete(lead.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                      <Trash2 size={15} />
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

// ─────────────────────────────────────────────
// Kanban View
// ─────────────────────────────────────────────
function KanbanView({ leads, onEdit, onDelete, onStatusChange }: {
  leads: Lead[]
  onEdit: (l: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: LeadStatus) => void
}) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto">
      {KANBAN_COLS.map(col => {
        const colLeads = leads.filter(l => l.status === col)
        return (
          <div key={col} className={`glass-card p-4 border-t-2 ${KANBAN_COLORS[col]} min-h-[400px]`}>
            <div className="flex items-center justify-between mb-4">
              <span className={STATUS_STYLE[col as LeadStatus]}>{col}</span>
              <span className="text-xs text-slate-500 font-medium">{colLeads.length}</span>
            </div>
            <div className="space-y-3">
              {colLeads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-slate-700">
                  <p className="text-xs">No leads</p>
                </div>
              )}
              {colLeads.map(lead => (
                <div key={lead.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 hover:border-slate-300 transition-colors cursor-pointer group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">{lead.fullName}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => onEdit(lead)} className="p-1 rounded text-blue-700 hover:bg-sky-500/10"><Edit3 size={12} /></button>
                      <button onClick={() => onDelete(lead.id)} className="p-1 rounded text-red-400 hover:bg-red-500/10"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {lead.companyName && <p className="text-xs text-slate-500">{lead.companyName}</p>}
                  <p className="text-xs text-blue-700">{lead.phone}</p>
                  <p className="text-xs text-slate-500 truncate">{lead.serviceInterested}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-600 inline-flex items-center px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">{lead.leadSource}</span>
                    <div className="flex gap-1">
                      {STATUSES.filter(s => s !== lead.status && s !== 'Lost').map(s => (
                        <button
                          key={s}
                          onClick={() => onStatusChange(lead.id, s)}
                          className="text-[10px] text-slate-500 hover:text-blue-700 transition-colors"
                          title={`Move to ${s}`}
                        >
                          →{s.charAt(0)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
