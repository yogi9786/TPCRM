import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../layouts/MainLayout'
import {
  MessageCircle, Send, Phone, CheckCheck, Clock,
  AlertCircle, Zap, Users, ToggleLeft, ToggleRight, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
  const [message, setMessage]           = useState('')
  const [templates, setTemplates]       = useState(() => {
    const saved = localStorage.getItem('whatsapp_templates')
    return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES
  })
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [newTemplate, setNewTemplate]   = useState({ name: '', body: '' })

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

  function applyTemplate(t: typeof DEFAULT_TEMPLATES[0]) {
    setSelectedTemplate(t.id)
    setMessage(t.body)
  }

  function handleSaveTemplate() {
    if (!newTemplate.name || !newTemplate.body) return toast.error('Name and body are required')
    setTemplates([...templates, { id: Date.now().toString(), name: newTemplate.name, body: newTemplate.body }])
    setNewTemplate({ name: '', body: '' })
    setShowTemplateModal(false)
    toast.success('Template saved!')
  }

  // ── Send WhatsApp message via backend ────────────────────────────────────
  async function sendMessage() {
    if (!phone.trim())   return toast.error('Enter a phone number')
    if (!message.trim()) return toast.error('Enter a message')
    setSending(true)
    try {
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
      setPhone('')
      setMessage('')
      setSelectedTemplate('')
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Twilio Connected</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Messages Sent',    value: outbound.length,  color: 'text-blue-400',    border: 'border-blue-500/20',    icon: Send },
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
        <div className="flex gap-1 border-b border-slate-800/60">
          {(['send', 'logs', 'automation'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                tab === t
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-white'
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
                      'w-full text-left p-3.5 rounded-xl border transition-all duration-150',
                      selectedTemplate === t.id
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
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
                              if (selectedTemplate === t.id) setSelectedTemplate('')
                            }
                          }}
                          className="text-slate-400 hover:text-red-500"
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
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Send size={14} className="text-blue-400" /> Compose &amp; Send
              </h2>

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
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
              <h2 className="text-sm font-semibold text-white">Message History</h2>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-800/60">
                    <tr>
                      {['Phone', 'Message', 'Direction', 'Status', 'Time'].map(h => (
                        <th key={h} className="table-header">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {messages.map((msg: any) => (
                      <tr key={msg.id} className="hover:bg-slate-800/30 transition-colors">
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
                            <span className="text-xs text-slate-400 capitalize">{msg.status}</span>
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
            <h2 className="text-base font-semibold text-white">Auto-Reply Settings</h2>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700/40">
              <div>
                <p className="text-sm font-medium text-white">Enable Auto Reply</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
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
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setShowTemplateModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveTemplate} className="btn-primary">Save Template</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
