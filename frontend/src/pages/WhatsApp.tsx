import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../layouts/MainLayout'
import {
  MessageCircle, Send, Phone, CheckCheck, Clock,
  AlertCircle, Zap, Users, ToggleLeft, ToggleRight, RefreshCw, User
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const API = 'https://tpcrm.onrender.com';

// Default templates
const DEFAULT_TEMPLATES = [
  { id: 't1', name: 'Welcome Message',  body: "Hi {{name}}! 👋 Welcome to TekhPortal. We're excited to connect with you. How can we help today?" },
  { id: 't2', name: 'Follow-up',        body: "Hi {{name}}, this is a quick follow-up from TekhPortal. Are you still interested in our {{service}} solutions?" },
  { id: 't3', name: 'Demo Invite',      body: "Hi {{name}}! We'd love to show you a live demo of TekhPortal CRM. When would be a good time for a 15-min call?" },
  { id: 't4', name: 'Closing Offer',   body: "Hi {{name}}, just checking in! We have a limited-time offer on {{service}}. Shall I share the details?" },
]

export default function WhatsApp() {
  const { currentUser } = useAuth()
  const [tab, setTab]                   = useState<'send' | 'logs' | 'automation'>('send')
  const [phone, setPhone]               = useState('')
  const [name, setName]                 = useState('')
  const [message, setMessage]           = useState('')
  const [templates, setTemplates]       = useState(() => {
    const saved = localStorage.getItem('whatsapp_templates')
    return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES
  })
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [newTemplate, setNewTemplate]   = useState({ name: '', body: '', imageUrl: '' })
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)

  useEffect(() => {
    localStorage.setItem('whatsapp_templates', JSON.stringify(templates))
  }, [templates])

  // ── Pre-fill phone and name from URL query parameters ──────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const phoneParam = params.get('phone')
    const nameParam = params.get('name')
    const broadcastParam = params.get('broadcast')
    
    if (phoneParam) {
      setPhone(phoneParam)
      setTab('send')
    } else if (broadcastParam) {
      setPhone(broadcastParam)
      setTab('send')
    }
    
    if (nameParam) {
      setMessage(`Hi ${nameParam}! 👋 Welcome to TekhPortal. `)
    }
  }, [])

  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [sending, setSending]           = useState(false)
  const [autoReply, setAutoReply]       = useState(true)
  const [autoMessage, setAutoMessage]   = useState("Hi! Thanks for reaching out to TekhPortal. We'll get back to you shortly. 🚀")
  const [messages, setMessages]         = useState<any[]>([])
  const [loadingLogs, setLoadingLogs]   = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchLogs().then(() => {
      setIsRefreshing(false)
      toast.success('WhatsApp data refreshed')
    })
  }

  // ── Fetch message logs from backend (not Firestore) ──────────────────────
  async function fetchLogs() {
    setLoadingLogs(true)
    try {
      const token = await currentUser?.getIdToken?.()
      const res = await fetch(`${API}/whatsapp/messages/all`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      } else {
        // Not critical — just show empty state
        setMessages([])
      }
    } catch {
      setMessages([])
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (tab === 'logs') fetchLogs()
  }, [tab])

  function applyTemplate(t: typeof DEFAULT_TEMPLATES[0] & { imageUrl?: string }) {
    setSelectedTemplate(t.id)
    setMessage(t.body)
    if (t.imageUrl) {
      setAttachmentUrl(t.imageUrl)
    } else {
      setAttachmentUrl('')
      setAttachmentFile(null)
    }
  }

  async function handleSaveTemplate() {
    if (!newTemplate.name || !newTemplate.body) return toast.error('Name and body are required')
    setSending(true) // Reusing sending state for loading
    try {
      let finalImageUrl = newTemplate.imageUrl
      if (templateFile) {
        if (templateFile.size > 10 * 1024 * 1024) {
          toast.error('Image exceeds 10MB limit')
          setSending(false)
          return
        }
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
        const { storage } = await import('../firebase')
        const fileRef = ref(storage, `templates/${currentUser!.uid}/${Date.now()}_${templateFile.name}`)
        await uploadBytes(fileRef, templateFile)
        finalImageUrl = await getDownloadURL(fileRef)
      }
      setTemplates([...templates, { id: Date.now().toString(), name: newTemplate.name, body: newTemplate.body, imageUrl: finalImageUrl }])
      setNewTemplate({ name: '', body: '', imageUrl: '' })
      setTemplateFile(null)
      setShowTemplateModal(false)
      toast.success('Template saved!')
    } catch (e) {
      toast.error('Failed to save template')
    } finally {
      setSending(false)
    }
  }

  // ── Send WhatsApp message via backend ────────────────────────────────────
  async function sendMessage() {
    if (!phone.trim())   return toast.error('Enter a phone number')
    if (!message.trim()) return toast.error('Enter a message')
    setSending(true)
    try {
      let finalAttachmentUrl = attachmentUrl
      if (attachmentFile) {
        if (attachmentFile.size > 10 * 1024 * 1024) {
          toast.error('Attachment exceeds 10MB limit')
          setSending(false)
          return
        }
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
        const { storage } = await import('../firebase')
        const fileRef = ref(storage, `whatsapp/${currentUser!.uid}/${Date.now()}_${attachmentFile.name}`)
        await uploadBytes(fileRef, attachmentFile)
        finalAttachmentUrl = await getDownloadURL(fileRef)
      }

      const token = await currentUser?.getIdToken?.()
      const res = await fetch(`${API}/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to: phone.trim(),
          body: message.trim(),
          lead_id: '',
          media_url: finalAttachmentUrl || undefined
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Backend returns { detail: { message, twilio_code, raw } } for 400 errors
        const detail = data?.detail
        const msg =
          (typeof detail === 'object' ? detail?.message : detail) ||
          data?.message ||
          `Error ${res.status}`
        throw Object.assign(new Error(msg), { response: data })
      }

      toast.success('WhatsApp message sent! ✅')

      // Auto-create lead if sending to a new number
      if (currentUser?.uid) {
        try {
          const q = query(collection(db, 'leads'), where('userId', '==', currentUser.uid), where('phone', '==', phone.trim()));
          const snap = await getDocs(q);
          if (snap.empty) {
            await addDoc(collection(db, 'leads'), {
              fullName: name.trim() || 'Unknown',
              phone: phone.trim(),
              email: '',
              companyName: '',
              leadSource: 'WhatsApp',
              serviceInterested: 'General',
              status: 'New',
              notes: 'Created automatically via WhatsApp outgoing template.',
              userId: currentUser.uid,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            toast.success('Lead automatically created in CRM!')
          }
        } catch (e) {
          console.error("Failed to auto-create lead", e)
        }
      }

      setPhone('')
      setName('')
      setMessage('')
      setSelectedTemplate('')
      setAttachmentUrl('')
      setAttachmentFile(null)
    } catch (err: unknown) {
      let msg = 'Failed to send message'
      if (err instanceof Error) {
        msg = err.message
      }
      // Try to parse structured error from backend 400 response
      if (err && typeof err === 'object' && 'message' in err) {
        msg = (err as any).message
      }
      toast.error(msg, { duration: 6000 })
    } finally {
      setSending(false)
    }
  }

  const statusIcon = (status: string) => {
    if (status === 'sent')      return <CheckCheck size={13} className="text-blue-400" />
    if (status === 'delivered') return <CheckCheck size={13} className="text-emerald-400" />
    if (status === 'failed')    return <AlertCircle size={13} className="text-red-400" />
    return <Clock size={13} className="text-slate-500" />
  }

  const outbound = messages.filter((m: any) => m.direction === 'outbound')
  const delivered = messages.filter((m: any) => m.status === 'delivered')
  const contacts  = new Set(messages.map((m: any) => m.phone)).size

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <MessageCircle className="text-emerald-400" size={22} />
              WhatsApp Automation
            </h1>
            <p className="page-subtitle">Send messages &amp; automate replies via Twilio</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button onClick={handleRefresh} className="btn-secondary px-3 py-1.5 h-auto">
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Twilio Connected</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Messages Sent',    value: outbound.length,  color: 'text-blue-400',    border: 'border-blue-200',    icon: Send },
            { label: 'Delivered',        value: delivered.length, color: 'text-emerald-400', border: 'border-emerald-500/20', icon: CheckCheck },
            { label: 'Contacts Reached', value: contacts,         color: 'text-violet-400',  border: 'border-violet-500/20',  icon: Users },
          ].map(({ label, value, color, border, icon: Icon }) => (
            <div key={label} className={`glass-card p-4 border ${border}`}>
              <Icon size={16} className={`${color} mb-2`} />
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {(['send', 'logs', 'automation'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                tab === t
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              )}
            >
              {t === 'send' ? 'Send Message' : t === 'logs' ? 'Message Logs' : 'Auto Reply'}
            </button>
          ))}
        </div>

        {/* ── SEND TAB ───────────────────────────────────── */}
        {tab === 'send' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.3fr] gap-5">
            {/* Templates */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Zap size={14} className="text-amber-500" /> Message Templates
                </h2>
                <button onClick={() => setShowTemplateModal(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  + Create
                </button>
              </div>
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {templates.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className={clsx(
                      'w-full text-left p-3.5 rounded-xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
                      selectedTemplate === t.id
                        ? 'border-blue-400 bg-blue-50/50 backdrop-blur-sm shadow-sm'
                        : 'border-slate-200/50 bg-white/40 backdrop-blur-sm hover:border-slate-300 hover:bg-white/70'
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                      {t.id.length > 5 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('Delete this template?')) {
                              setTemplates(templates.filter((tmpl: any) => tmpl.id !== t.id))
                              if (selectedTemplate === t.id) {
                                setSelectedTemplate('')
                                setAttachmentUrl('')
                              }
                            }
                          }}
                          className="text-slate-500 hover:text-red-500"
                        >
                          <AlertCircle size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{t.body}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Compose */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Send size={14} className="text-blue-400" /> Compose &amp; Send
              </h2>

              <div>
                <label className="label">Recipient Name (Optional)</label>
                <div className="relative mb-4">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="label">Recipient Phone Number</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    id="whatsapp-phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="input-field pl-10"
                  />
                </div>
                <p className="text-[11px] text-slate-600 mt-1">Include country code, e.g. +91 for India</p>
              </div>

              <div>
                <label className="label">Message</label>
                <textarea
                  id="whatsapp-message"
                  rows={6}
                  placeholder="Type your message... Use {{name}} for personalisation"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="input-field resize-none"
                />
                <p className="text-[11px] text-slate-600 mt-1">{message.length} characters</p>
              </div>

              <div>
                <label className="label">Attachment Image (Optional)</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                  />
                  {!attachmentFile && attachmentUrl && (
                    <div className="relative w-24 h-24 mt-2">
                      <img src={attachmentUrl} alt="Attachment" className="w-full h-full object-cover rounded-xl border border-slate-200" />
                      <button 
                        onClick={() => setAttachmentUrl('')} 
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                id="whatsapp-send-btn"
                onClick={sendMessage}
                disabled={sending || !phone || !message}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending…
                  </span>
                ) : (
                  <><Send size={16} /> Send WhatsApp Message</>
                )}
              </button>

              {/* Sandbox notice */}
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-400 font-medium mb-1">⚠️ Twilio Sandbox Mode</p>
                <p className="text-[11px] text-slate-500">
                  The recipient must first send <span className="font-mono text-amber-300">"join &lt;your-sandbox-word&gt;"</span> to{' '}
                  <span className="font-mono text-amber-300">+1 415 523 8886</span> to opt-in before messages can be delivered.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── LOGS TAB ───────────────────────────────────── */}
        {tab === 'logs' && (
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Message History</h2>
              <button onClick={fetchLogs} className="btn-secondary text-xs py-1.5 px-3">
                <RefreshCw size={13} className={loadingLogs ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <MessageCircle size={36} className="mb-3 opacity-20" />
                <p className="font-medium text-slate-500">No messages yet</p>
                <p className="text-sm mt-1">Send your first WhatsApp message</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="border-b border-slate-200">
                    <tr>
                      {['Phone', 'Message', 'Direction', 'Status', 'Time'].map(h => (
                        <th key={h} className="table-header">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {messages.map((msg: any) => (
                      <tr key={msg.id} className="hover:bg-white/40 transition-colors">
                        <td className="table-cell text-blue-400 font-medium">{msg.phone}</td>
                        <td className="table-cell max-w-[260px] truncate">{msg.body}</td>
                        <td className="table-cell">
                          <span className={clsx('badge',
                            msg.direction === 'outbound' ? 'badge-contacted' : 'badge-closed'
                          )}>
                            {msg.direction}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="flex items-center gap-1.5">
                            {statusIcon(msg.status)}
                            <span className="text-xs text-slate-500 capitalize">{msg.status}</span>
                          </span>
                        </td>
                        <td className="table-cell text-slate-500 text-xs">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── AUTO REPLY TAB ─────────────────────────────── */}
        {tab === 'automation' && (
          <div className="glass-card p-6 space-y-5 max-w-2xl">
            <h2 className="text-base font-semibold text-slate-900">Auto-Reply Settings</h2>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-medium text-slate-900">Enable Auto Reply</p>
                <p className="text-xs text-slate-500 mt-0.5">Automatically respond to incoming WhatsApp messages</p>
              </div>
              <button onClick={() => setAutoReply(!autoReply)} className="transition-colors">
                {autoReply
                  ? <ToggleRight size={32} className="text-blue-400" />
                  : <ToggleLeft  size={32} className="text-slate-600" />
                }
              </button>
            </div>

            <div>
              <label className="label">Auto-Reply Message</label>
              <textarea
                rows={4}
                value={autoMessage}
                onChange={e => setAutoMessage(e.target.value)}
                disabled={!autoReply}
                className={clsx('input-field resize-none', !autoReply && 'opacity-40 cursor-not-allowed')}
              />
            </div>

            <button
              onClick={() => toast.success('Auto-reply settings saved!')}
              disabled={!autoReply}
              className={clsx('btn-primary', !autoReply && 'opacity-40 cursor-not-allowed')}
            >
              Save Settings
            </button>
          </div>
        )}

      </div>

      {/* Create Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-6 space-y-5 animate-slide-up border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Create New Template</h2>
            <div>
              <label className="label">Template Name</label>
              <input 
                className="input-field" 
                placeholder="e.g. Special Discount"
                value={newTemplate.name}
                onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
              />
            </div>
            <div>
              <label className="label">Message Body</label>
              <textarea 
                className="textarea-field h-24"
                placeholder="Hi {{name}}, we have a special discount for you..."
                value={newTemplate.body}
                onChange={e => setNewTemplate({...newTemplate, body: e.target.value})}
              />
              <p className="text-[11px] text-slate-500 mt-1">Use {'{{name}}'}, {'{{service}}'} for variables.</p>
            </div>
            <div>
              <label className="label">Header Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                onChange={e => setTemplateFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowTemplateModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveTemplate} disabled={sending} className="btn-primary">
                {sending ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
