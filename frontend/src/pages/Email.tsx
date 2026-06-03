import { useState, useEffect, useRef } from 'react'
import MainLayout from '../layouts/MainLayout'
import { useAuth } from '../contexts/AuthContext'
import {
  Mail, Send, Inbox, Clock, CheckCircle2, XCircle, Search,
  ChevronDown, RefreshCw, User, FileText, ExternalLink, Paperclip,
  MailOpen, AlertCircle, Plus, X, Eye, Users, Trash2, Edit3, LayoutGrid, List, Filter
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useNavigate } from 'react-router-dom'

const API = 'https://tpcrm.onrender.com'

interface EmailRecord {
  id: string
  toEmail: string
  toName: string
  subject: string
  body: string
  direction: 'outbound' | 'inbound'
  status: 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed'
  brevoMessageId: string
  createdAt: string
  leadId?: string
}

interface ComposeForm {
  toEmail: string
  toName: string
  subject: string
  body: string
  isHtml: boolean
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-blue-50 text-blue-600 border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  opened: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  bounced: 'bg-red-50 text-red-600 border-red-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  sent: <Clock size={11} />,
  delivered: <CheckCircle2 size={11} />,
  opened: <MailOpen size={11} />,
  bounced: <XCircle size={11} />,
  failed: <XCircle size={11} />,
}

export default function Email() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'compose' | 'sent' | 'brevo-logs' | 'leads'>('leads')
  const [emails, setEmails] = useState<EmailRecord[]>([])
  const [brevoLogs, setBrevoLogs] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [showEditLead, setShowEditLead] = useState(false)
  const [editLeadForm, setEditLeadForm] = useState<any>(null)
  const [compose, setCompose] = useState<ComposeForm>({
    toEmail: '',
    toName: '',
    subject: '',
    body: '',
    isHtml: false,
  })

  const token = async () => {
    if (!currentUser) return ''
    return await currentUser.getIdToken()
  }

  const authHeaders = async () => ({
    Authorization: `Bearer ${await token()}`,
    'Content-Type': 'application/json',
  })

  async function fetchEmails() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/email/history?limit=100`, {
        headers: await authHeaders(),
      })
      if (res.status === 401) {
        toast.error('Session expired. Please log in again.')
        await logout()
        navigate('/login')
        return
      }
      if (!res.ok) throw new Error(await res.text())
      setEmails(await res.json())
    } catch (e: any) {
      toast.error('Failed to load email history')
    } finally {
      setLoading(false)
    }
  }

  async function fetchBrevoLogs() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/email/logs/brevo?limit=50`, {
        headers: await authHeaders(),
      })
      if (res.status === 401) {
        toast.error('Session expired. Please log in again.')
        await logout()
        navigate('/login')
        return
      }
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBrevoLogs(data.events || data.logs || [])
    } catch (e: any) {
      toast.error('Failed to load Brevo logs')
    } finally {
      setLoading(false)
    }
  }

  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleRefresh = () => {
    setIsRefreshing(true)
    Promise.all([fetchEmails(), fetchBrevoLogs()]).then(() => {
      setIsRefreshing(false)
      toast.success('Email data refreshed')
    })
  }

  useEffect(() => {
    if (!currentUser) return
    if (tab === 'sent') {
      fetchEmails()
      fetchBrevoLogs()
    }
    if (tab === 'brevo-logs') fetchBrevoLogs()
    if (tab === 'leads') {
      setLoading(true)
      const q = query(collection(db, 'leads'), where('userId', '==', currentUser.uid))
      const unsub = onSnapshot(q, snap => {
        setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      })
      return unsub
    }
  }, [tab, currentUser])

  async function handleSend() {
    if (!compose.toEmail || !compose.subject || !compose.body) {
      toast.error('Please fill in all required fields')
      return
    }
    setSending(true)
    const emailsToSend = compose.toEmail.split(',').map(e => e.trim()).filter(e => e)
    let successCount = 0

    try {
      const htmlContent = compose.isHtml
        ? compose.body
        : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;white-space:pre-wrap">${compose.body}</div>`

      for (const email of emailsToSend) {
        const res = await fetch(`${API}/email/send`, {
          method: 'POST',
          headers: await authHeaders(),
          body: JSON.stringify({
            to_email: email,
            to_name: compose.toName || email.split('@')[0],
            subject: compose.subject,
            html_content: htmlContent,
            text_content: compose.body,
          }),
        })
        if (res.status === 401) {
          toast.error('Session expired. Please log in again.')
          await logout()
          navigate('/login')
          return
        }
        if (res.ok) successCount++
      }

      if (successCount > 0) {
        toast.success(`Sent emails to ${successCount} recipients!`)
        setCompose({ toEmail: '', toName: '', subject: '', body: '', isHtml: false })
        setTab('sent')
      } else {
        toast.error('Failed to send emails')
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  async function saveLeadEdit() {
    if (!editLeadForm?.id) return
    try {
      await updateDoc(doc(db, 'leads', editLeadForm.id), {
        fullName: editLeadForm.fullName,
        email: editLeadForm.email,
        phone: editLeadForm.phone,
        updatedAt: new Date().toISOString(),
      })
      toast.success('Lead updated')
      setShowEditLead(false)
    } catch (e) {
      toast.error('Failed to update lead')
    }
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead?')) return
    try {
      await deleteDoc(doc(db, 'leads', id))
      toast.success('Lead deleted')
      setSelectedLeadIds(prev => prev.filter(x => x !== id))
    } catch (e) {
      toast.error('Failed to delete lead')
    }
  }

  // Dynamically compute statuses by matching with real-time Brevo logs
  const computedEmails = emails.map(email => {
    if (!email.brevoMessageId) return email;
    // Find all events for this message
    const events = brevoLogs.filter((log: any) => log.messageId === email.brevoMessageId);
    if (!events.length) return email;

    // Determine highest priority status
    const eventTypes = events.map((e: any) => e.event);
    let newStatus = email.status;
    if (eventTypes.includes('bounced') || eventTypes.includes('hardBounced') || eventTypes.includes('softBounced')) newStatus = 'bounced';
    else if (eventTypes.includes('spam') || eventTypes.includes('invalid')) newStatus = 'failed';
    else if (eventTypes.includes('opened') || eventTypes.includes('clicks')) newStatus = 'opened';
    else if (eventTypes.includes('delivered')) newStatus = 'delivered';

    return { ...email, status: newStatus };
  });

  const filteredEmails = computedEmails.filter(e =>
    e.toEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.toName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Mail className="text-blue-500" size={24} /> Email
            </h1>
            <p className="page-subtitle">Send transactional emails via Brevo &amp; track delivery</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRefresh} className="btn-secondary px-3">
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setTab('compose')}
              className="btn-primary"
            >
              <Plus size={15} /> Compose
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Sent', value: computedEmails.length, icon: Send, color: 'text-blue-500 bg-blue-50' },
            { label: 'Delivered', value: computedEmails.filter(e => e.status === 'delivered' || e.status === 'opened').length, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
            { label: 'Opened', value: computedEmails.filter(e => e.status === 'opened').length, icon: MailOpen, color: 'text-indigo-500 bg-indigo-50' },
            { label: 'Bounced', value: computedEmails.filter(e => e.status === 'bounced' || e.status === 'failed').length, icon: XCircle, color: 'text-red-500 bg-red-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card p-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${color.split(' ')[1]}`}>
                <Icon size={16} className={color.split(' ')[0]} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {[
            { id: 'leads', label: 'Leads', icon: Users },
            { id: 'compose', label: 'Compose', icon: Plus },
            { id: 'sent', label: 'Sent', icon: Send },
            { id: 'brevo-logs', label: 'Brevo Logs', icon: ExternalLink },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* ── LEADS TAB ── */}
        {tab === 'leads' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search leads by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-9 py-2 text-xs"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-16">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Users size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-slate-700">No leads available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3.5 text-left w-10">
                        <input
                          type="checkbox"
                          checked={leads.length > 0 && leads.every(l => selectedLeadIds.includes(l.id))}
                          onChange={() => {
                            if (leads.every(l => selectedLeadIds.includes(l.id))) {
                              setSelectedLeadIds([])
                            } else {
                              setSelectedLeadIds(leads.map(l => l.id))
                            }
                          }}
                          className="rounded border-slate-200 bg-white text-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Phone</th>
                      <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {leads.filter(l => (l.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.email || '').toLowerCase().includes(searchQuery.toLowerCase())).map(lead => (
                      <tr key={lead.id} className={clsx('hover:bg-white/40 transition-colors', selectedLeadIds.includes(lead.id) && 'bg-blue-50/30')}>
                        <td className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => {
                              setSelectedLeadIds(prev => prev.includes(lead.id) ? prev.filter(x => x !== lead.id) : [...prev, lead.id])
                            }}
                            className="rounded border-slate-200 bg-white text-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{lead.fullName}</td>
                        <td className="px-4 py-3 text-slate-500">{lead.email || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{lead.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => { setEditLeadForm(lead); setShowEditLead(true) }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit3 size={15} /></button>
                            <button onClick={() => deleteLead(lead.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Floating Bulk Action */}
        {tab === 'leads' && selectedLeadIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white border border-slate-200 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-xl backdrop-blur-md">
            <div className="text-sm font-semibold text-slate-800">
              <span className="text-blue-600">{selectedLeadIds.length}</span> leads selected
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const selectedLeads = leads.filter(l => selectedLeadIds.includes(l.id) && l.email)
                  if (selectedLeads.length === 0) {
                    toast.error('No emails found for selected leads')
                    return
                  }
                  const emails = selectedLeads.map(l => l.email).join(', ')
                  setCompose(c => ({ ...c, toEmail: emails }))
                  setTab('compose')
                  setSelectedLeadIds([])
                }}
                className="btn-primary py-2 px-4 text-xs"
              >
                <Mail size={14} /> Send Bulk Email
              </button>
            </div>
          </div>
        )}

        {/* ── COMPOSE TAB ── */}
        {tab === 'compose' && (
          <div className="glass-card p-6 space-y-4 max-w-3xl">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Mail size={16} className="text-blue-500" /> New Email
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">To Email (Comma separated) *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="recipient1@example.com, recipient2@example.com"
                  value={compose.toEmail}
                  onChange={e => setCompose(c => ({ ...c, toEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Recipient Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="John Doe"
                  value={compose.toName}
                  onChange={e => setCompose(c => ({ ...c, toName: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="label">Subject *</label>
              <input
                type="text"
                className="input-field"
                placeholder="Email subject line"
                value={compose.subject}
                onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Message *</label>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <span>HTML mode</span>
                  <button
                    onClick={() => setCompose(c => ({ ...c, isHtml: !c.isHtml }))}
                    className={clsx(
                      'relative w-9 h-5 rounded-full transition-colors duration-200',
                      compose.isHtml ? 'bg-blue-500' : 'bg-slate-300'
                    )}
                  >
                    <div className={clsx(
                      'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                      compose.isHtml ? 'translate-x-4' : 'translate-x-0.5'
                    )} />
                  </button>
                </label>
              </div>
              <textarea
                rows={10}
                className="input-field resize-none font-mono text-xs"
                placeholder={compose.isHtml ? '<p>Write HTML email here...</p>' : 'Write your message here...'}
                value={compose.body}
                onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSend}
                disabled={sending}
                className="btn-primary"
              >
                {sending ? (
                  <><RefreshCw size={14} className="animate-spin" /> Sending...</>
                ) : (
                  <><Send size={14} /> Send Email</>
                )}
              </button>
              <button
                onClick={() => setCompose({ toEmail: '', toName: '', subject: '', body: '', isHtml: false })}
                className="btn-secondary"
              >
                <X size={14} /> Clear
              </button>
            </div>
          </div>
        )}

        {/* ── SENT TAB ── */}
        {tab === 'sent' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-9 py-2 text-xs"
                />
              </div>
              <button onClick={fetchEmails} className="btn-secondary py-2 px-3 text-xs">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-16">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Mail size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-slate-700">No emails sent yet</p>
                <p className="text-xs mt-1">Compose an email to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredEmails.map(email => (
                  <div
                    key={email.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/40 cursor-pointer transition-colors group"
                    onClick={() => { setSelectedEmail(email); setPreviewOpen(true) }}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
                      {email.toName?.charAt(0).toUpperCase() || email.toEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{email.toName || email.toEmail}</p>
                      <p className="text-xs text-slate-500 truncate">{email.toEmail}</p>
                    </div>
                    <div className="min-w-0 flex-[2] hidden md:block">
                      <p className="text-sm text-slate-800 font-medium truncate">{email.subject}</p>
                      <p className="text-xs text-slate-400 truncate">{email.body?.replace(/<[^>]+>/g, '').slice(0, 80)}</p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-3">
                      <span className={clsx(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1',
                        STATUS_COLORS[email.status] || STATUS_COLORS.sent
                      )}>
                        {STATUS_ICONS[email.status]} {email.status}
                      </span>
                      <span className="text-xs text-slate-400 hidden lg:block">
                        {new Date(email.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Eye size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BREVO LOGS TAB ── */}
        {tab === 'brevo-logs' && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Brevo SMTP Logs</h3>
                <p className="text-xs text-slate-500 mt-0.5">Live delivery stats from Brevo dashboard</p>
              </div>
              <button onClick={fetchBrevoLogs} className="btn-secondary py-2 px-3 text-xs">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-16">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
              </div>
            ) : brevoLogs.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <FileText size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-slate-700">No Brevo logs yet</p>
                <p className="text-xs mt-1">Send an email first to see delivery status here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="text-left px-4 py-3">To</th>
                      <th className="text-left px-4 py-3">Subject</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Message ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {brevoLogs.map((log: any, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{log.to?.[0]?.email || log.email || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">{log.subject || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'text-[10px] px-2 py-0.5 rounded-full font-semibold border',
                            STATUS_COLORS[log.status?.toLowerCase()] || STATUS_COLORS.sent
                          )}>
                            {log.status || 'sent'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {log.date ? new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-[9px] truncate max-w-[140px]">{log.messageId || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Email Preview Modal ── */}
      {previewOpen && selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-slate-200 flex-shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">{selectedEmail.subject}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  To: {selectedEmail.toName} &lt;{selectedEmail.toEmail}&gt;
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(selectedEmail.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors flex-shrink-0 ml-3">
                <X size={16} />
              </button>
            </div>

            {/* Status bar */}
            <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50 flex-shrink-0">
              <span className={clsx(
                'text-[10px] px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5',
                STATUS_COLORS[selectedEmail.status] || STATUS_COLORS.sent
              )}>
                {STATUS_ICONS[selectedEmail.status]} {selectedEmail.status.toUpperCase()}
              </span>
              {selectedEmail.brevoMessageId && (
                <span className="text-[10px] text-slate-400 font-mono">ID: {selectedEmail.brevoMessageId}</span>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div
                className="prose prose-sm max-w-none text-slate-800 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditLead && editLeadForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit Lead</h2>
              <button onClick={() => setShowEditLead(false)} className="text-slate-500 hover:text-slate-900"><X size={20} /></button>
            </div>
            <div>
              <label className="label">Full Name</label>
              <input type="text" className="input-field" value={editLeadForm.fullName} onChange={e => setEditLeadForm({ ...editLeadForm, fullName: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input-field" value={editLeadForm.email} onChange={e => setEditLeadForm({ ...editLeadForm, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="text" className="input-field" value={editLeadForm.phone} onChange={e => setEditLeadForm({ ...editLeadForm, phone: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowEditLead(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveLeadEdit} className="btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
