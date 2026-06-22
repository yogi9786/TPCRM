import { useState, useEffect, useCallback, useRef } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  RefreshCw, Download, CheckCircle, AlertCircle, Users,
  Facebook, Instagram, MessageCircle, ArrowRight, Zap,
  User, Clock, Mail, Phone, Tag, ChevronDown, ChevronUp,
  InboxIcon, LayoutGrid, List, Circle, MessageSquare, ArrowLeft
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'

const API = import.meta.env.VITE_API_URL || 'https://tpcrm.onrender.com'

type Tab = 'overview' | 'leads' | 'messages'

interface MetaLead {
  id: string
  leadgenId?: string
  formId?: string
  formName?: string
  campaignName?: string
  adName?: string
  source?: string
  fieldData?: Record<string, string>
  importedToCRM?: boolean
  crmLeadId?: string
  createdAt?: string
  metaCreatedTime?: string
}

interface MetaMessage {
  id: string
  mid?: string
  senderId: string
  recipientId?: string
  pageId?: string
  direction: 'inbound' | 'outbound'
  text: string
  attachments?: { type: string; url: string }[]
  source: 'facebook' | 'instagram'
  timestamp: string
  createdAt?: string
  read: boolean
}

interface Conversation {
  senderId: string
  source: 'facebook' | 'instagram'
  lastMessage: string
  lastTimestamp: string
  unreadCount: number
  messageCount: number
  messages: MetaMessage[]
}

interface Stats {
  total?: number
  imported?: number
  pending?: number
  facebook?: number
  instagram?: number
}

interface MsgStats {
  total?: number
  inbound?: number
  unread?: number
  unique_senders?: number
  facebook?: number
  instagram?: number
}

interface ConfigStatus {
  app_id_set: boolean
  app_secret_set: boolean
  page_access_token_set: boolean
  page_id_set: boolean
  ad_account_id_set: boolean
  fully_configured: boolean
}

export default function MetaPage() {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Leads state
  const [metaLeads, setMetaLeads] = useState<MetaLead[]>([])
  const [leadStats, setLeadStats] = useState<Stats>({})
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [expandedLead, setExpandedLead] = useState<string | null>(null)

  // Messages state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null)
  const [msgStats, setMsgStats] = useState<MsgStats>({})
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [msgFilter, setMsgFilter] = useState<'all' | 'facebook' | 'instagram'>('all')
  const [syncingMsgs, setSyncingMsgs] = useState(false)

  // Overview state
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const getToken = useCallback(async () => {
    return (await currentUser?.getIdToken?.()) ?? ''
  }, [currentUser])

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const token = await getToken()
    return fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true', ...opts.headers },
    })
  }, [getToken])

  // Load config
  useEffect(() => {
    if (!currentUser) return
    authFetch(`${API}/meta/config/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfigStatus(d) })
      .catch(() => {})
  }, [currentUser, authFetch])

  // Load leads
  const loadLeads = useCallback(async () => {
    setLeadsLoading(true)
    try {
      const [leadsRes, statsRes] = await Promise.all([
        authFetch(`${API}/meta/leads?limit=200`),
        authFetch(`${API}/meta/leads/stats`),
      ])
      if (leadsRes.ok) setMetaLeads(await leadsRes.json())
      if (statsRes.ok) setLeadStats(await statsRes.json())
    } catch { toast.error('Failed to load Meta leads') }
    finally { setLeadsLoading(false) }
  }, [authFetch])

  // Load messages (conversations)
  const loadMessages = useCallback(async () => {
    setMsgsLoading(true)
    try {
      const [convRes, statsRes] = await Promise.all([
        authFetch(`${API}/meta/messages/conversations`),
        authFetch(`${API}/meta/messages/stats`),
      ])
      if (convRes.ok) setConversations(await convRes.json())
      if (statsRes.ok) setMsgStats(await statsRes.json())
    } catch { toast.error('Failed to load messages') }
    finally { setMsgsLoading(false) }
  }, [authFetch])

  useEffect(() => {
    if (!currentUser) return
    if (activeTab === 'leads' || activeTab === 'overview') loadLeads()
    if (activeTab === 'messages' || activeTab === 'overview') loadMessages()
  }, [activeTab, currentUser, loadLeads, loadMessages])

  // Auto-poll messages every 15 seconds when on messages tab
  useEffect(() => {
    if (activeTab === 'messages') {
      pollRef.current = setInterval(loadMessages, 15000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [activeTab, loadMessages])

  async function syncLeads() {
    setSyncing(true)
    try {
      const res = await authFetch(`${API}/meta/sync`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Synced ${data.new_leads_synced ?? 0} new leads`)
        loadLeads()
      } else {
        toast.error(data.detail || 'Sync failed')
      }
    } catch { toast.error('Sync failed — check backend connection') }
    finally { setSyncing(false) }
  }

  async function syncMessages() {
    setSyncingMsgs(true)
    try {
      const res = await authFetch(`${API}/meta/messages/sync`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        if (data.status === 'error' || data.status === 'skipped') {
          toast.error(data.reason || 'Message sync failed', { duration: 6000 })
        } else {
          toast.success(`Synced ${data.new_messages_synced ?? 0} messages from ${data.conversations_found ?? 0} conversations`)
          loadMessages()
        }
      } else {
        toast.error(data.detail || 'Message sync failed')
      }
    } catch { toast.error('Message sync failed — check backend connection') }
    finally { setSyncingMsgs(false) }
  }

  async function importLead(lead: MetaLead) {
    setImporting(lead.id)
    try {
      const res = await authFetch(`${API}/meta/leads/${lead.id}/import`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.already_imported ? 'Already in CRM' : 'Imported to CRM!')
        loadLeads()
      } else {
        toast.error(data.detail || 'Import failed')
      }
    } catch { toast.error('Import failed') }
    finally { setImporting(null) }
  }

  async function markConvoRead(senderId: string) {
    try {
      await authFetch(`${API}/meta/messages/conversations/${senderId}/read`, { method: 'PATCH' })
      setConversations(prev => prev.map(c =>
        c.senderId === senderId ? { ...c, unreadCount: 0 } : c
      ))
      if (selectedConvo?.senderId === senderId) {
        setSelectedConvo(prev => prev ? { ...prev, unreadCount: 0 } : prev)
      }
    } catch {}
  }

  function exportLeadsCSV() {
    const header = ['Name', 'Email', 'Phone', 'Source', 'Campaign', 'Form', 'Status', 'Date']
    const rows = metaLeads.map(l => [
      l.fieldData?.full_name || l.fieldData?.name || 'Unknown',
      l.fieldData?.email || '',
      l.fieldData?.phone_number || l.fieldData?.phone || '',
      l.source || '',
      l.campaignName || '',
      l.formName || l.formId || '',
      l.importedToCRM ? 'In CRM' : 'Pending',
      l.metaCreatedTime || l.createdAt || '',
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'meta_leads.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
  }

  const filteredConvos = conversations.filter(c => {
    if (msgFilter === 'all') return true
    return c.source === msgFilter
  })

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0)

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Facebook size={17} className="text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Meta Integration</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1 ml-12">Facebook & Instagram leads and messages</p>
          </div>

          {/* Connection status badge */}
          <div className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold',
            configStatus?.fully_configured
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          )}>
            {configStatus?.fully_configured
              ? <><CheckCircle size={14} /> Connected</>
              : <><AlertCircle size={14} /> {configStatus ? 'Partially Configured' : 'Checking...'}</>
            }
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          {([
            { id: 'overview', label: 'Overview', icon: LayoutGrid },
            { id: 'leads', label: `Leads${leadStats.total ? ` (${leadStats.total})` : ''}`, icon: Users },
            { id: 'messages', label: `Messages${totalUnread > 0 ? ` · ${totalUnread}` : ''}`, icon: MessageCircle },
          ] as { id: Tab; label: string; icon: typeof Users }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150',
                activeTab === tab.id
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.id === 'messages' && totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════ OVERVIEW TAB ══════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-5">

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Leads', value: leadStats.total ?? 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
                { label: 'In CRM', value: leadStats.imported ?? 0, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Messages', value: msgStats.total ?? 0, icon: MessageCircle, color: 'text-purple-600 bg-purple-50' },
                { label: 'Unread', value: msgStats.unread ?? 0, icon: Circle, color: 'text-rose-600 bg-rose-50' },
              ].map(stat => (
                <div key={stat.label} className="glass-card p-5">
                  <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center mb-3', stat.color)}>
                    <stat.icon size={17} />
                  </div>
                  <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Sources breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Facebook size={16} className="text-blue-600" />
                  <p className="font-bold text-slate-800">Facebook</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Ad Leads</span><span className="font-bold text-slate-900">{leadStats.facebook ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Messages</span><span className="font-bold text-slate-900">{msgStats.facebook ?? 0}</span></div>
                </div>
              </div>
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Instagram size={16} className="text-pink-600" />
                  <p className="font-bold text-slate-800">Instagram</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Ad Leads</span><span className="font-bold text-slate-900">{leadStats.instagram ?? 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Messages</span><span className="font-bold text-slate-900">{msgStats.instagram ?? 0}</span></div>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="glass-card p-5">
              <p className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Zap size={15} className="text-amber-500" /> Quick Actions</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={syncLeads}
                  disabled={syncing}
                  className="btn-primary flex items-center gap-2"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync All Leads'}
                </button>
                <button onClick={() => setActiveTab('leads')} className="btn-secondary flex items-center gap-2">
                  <Users size={14} /> View Leads <ArrowRight size={13} />
                </button>
                <button onClick={() => setActiveTab('messages')} className="btn-secondary flex items-center gap-2">
                  <MessageCircle size={14} /> View Messages <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Webhook status card */}
            <div className="glass-card p-5">
              <p className="font-bold text-slate-800 mb-3">Credential Status</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {configStatus && Object.entries({
                  'App ID': configStatus.app_id_set,
                  'App Secret': configStatus.app_secret_set,
                  'Page Token': configStatus.page_access_token_set,
                  'Page ID': configStatus.page_id_set,
                  'Ad Account': configStatus.ad_account_id_set,
                }).map(([label, ok]) => (
                  <div key={label} className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm',
                    ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
                  )}>
                    {ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    <span className="font-medium">{label}</span>
                    <span className="ml-auto text-xs">{ok ? 'Set ✓' : 'Missing'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ LEADS TAB ═════════════════════════════ */}
        {activeTab === 'leads' && (
          <div className="space-y-4">

            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users size={15} className="text-slate-400" />
                <span className="font-semibold">{metaLeads.length} Meta Leads</span>
                {leadStats.pending != null && leadStats.pending > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    {leadStats.pending} pending import
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportLeadsCSV} className="btn-secondary flex items-center gap-2">
                  <Download size={14} /> Export CSV
                </button>
                <button
                  onClick={syncLeads}
                  disabled={syncing}
                  className="btn-primary flex items-center gap-2"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync Leads'}
                </button>
              </div>
            </div>

            {leadsLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : metaLeads.length === 0 ? (
              <div className="glass-card flex flex-col items-center py-16 text-slate-500">
                <Users size={36} className="mb-3 opacity-20" />
                <p className="font-semibold">No Meta leads yet</p>
                <p className="text-xs text-slate-400 mt-1">Click Sync Leads or wait for webhook events from your forms</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metaLeads.map(lead => {
                  const fd = lead.fieldData || {}
                  const name = fd.full_name || fd.name || `${fd.first_name || ''} ${fd.last_name || ''}`.trim() || 'Unknown'
                  const isExpanded = expandedLead === lead.id
                  return (
                    <div key={lead.id} className="glass-card overflow-hidden">
                      {/* Lead row */}
                      <div className="p-4 flex items-center gap-4">
                        {/* Avatar */}
                        <div className={clsx(
                          'w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
                          lead.source === 'Instagram Ads' ? 'bg-gradient-to-br from-pink-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-700'
                        )}>
                          {name.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-900 truncate">{name}</p>
                            <span className={clsx(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold',
                              lead.source === 'Instagram Ads'
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-blue-100 text-blue-700'
                            )}>
                              {lead.source === 'Instagram Ads' ? '📷 Instagram' : '📘 Facebook'}
                            </span>
                            {lead.importedToCRM
                              ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">✓ In CRM</span>
                              : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Pending</span>
                            }
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                            {fd.email && <span className="flex items-center gap-1"><Mail size={10} />{fd.email}</span>}
                            {(fd.phone_number || fd.phone) && <span className="flex items-center gap-1"><Phone size={10} />{fd.phone_number || fd.phone}</span>}
                            {lead.campaignName && <span className="flex items-center gap-1"><Tag size={10} />{lead.campaignName}</span>}
                            <span className="flex items-center gap-1"><Clock size={10} />{new Date(lead.metaCreatedTime || lead.createdAt || '').toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!lead.importedToCRM && (
                            <button
                              onClick={() => importLead(lead)}
                              disabled={importing === lead.id}
                              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                            >
                              {importing === lead.id ? <RefreshCw size={11} className="animate-spin" /> : <ArrowRight size={11} />}
                              Import
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            {Object.entries(fd).map(([key, val]) => val ? (
                              <div key={key}>
                                <p className="text-slate-400 capitalize mb-0.5">{key.replace(/_/g, ' ')}</p>
                                <p className="font-semibold text-slate-800">{val}</p>
                              </div>
                            ) : null)}
                            {lead.formId && (
                              <div>
                                <p className="text-slate-400 mb-0.5">Form ID</p>
                                <p className="font-mono text-slate-700 text-[10px] break-all">{lead.formId}</p>
                              </div>
                            )}
                            {lead.leadgenId && (
                              <div>
                                <p className="text-slate-400 mb-0.5">Lead ID</p>
                                <p className="font-mono text-slate-700 text-[10px] break-all">{lead.leadgenId}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ MESSAGES TAB ══════════════════════════ */}
        {activeTab === 'messages' && (
          <div className="space-y-4">

            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={syncMessages}
                  disabled={syncingMsgs}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <RefreshCw size={13} className={syncingMsgs ? 'animate-spin' : ''} />
                  {syncingMsgs ? 'Syncing...' : 'Sync History'}
                </button>
                <button
                  onClick={loadMessages}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <RefreshCw size={13} /> Refresh
                </button>
                {/* Source filter */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  {(['all', 'facebook', 'instagram'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setMsgFilter(f)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                        msgFilter === f ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'
                      )}
                    >
                      {f === 'all' ? 'All' : f === 'facebook' ? '📘 Facebook' : '📷 Instagram'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span><b>{msgStats.unique_senders ?? 0}</b> conversations</span>
                {(msgStats.unread ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                    {msgStats.unread} unread
                  </span>
                )}
              </div>
            </div>

            {/* ── Meta Permissions Info Banner ─────────────────── */}
            {!configStatus?.fully_configured && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">Messages require Meta Webhook configuration</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Set up your webhook at <b>https://tpcrm.onrender.com/api/meta/webhook</b> with verify token <b>tekhportal_webhook</b> in your Meta App Dashboard → Webhooks.
                    Messages will appear here in real-time after that.
                  </p>
                </div>
              </div>
            )}

            {msgsLoading && conversations.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-7 h-7 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex lg:grid lg:grid-cols-[340px_1fr] gap-4 h-[600px] w-full">

                {/* ── Conversation List ─────────────────────────── */}
                <div className={clsx("glass-card overflow-hidden flex-col w-full lg:w-auto", selectedConvo ? "hidden lg:flex" : "flex")}>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800">Conversations</p>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredConvos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400">
                        <InboxIcon size={32} className="mb-2 opacity-30" />
                        <p className="text-sm font-medium">No messages yet</p>
                        <p className="text-xs mt-1 text-center px-4">Messages from Facebook & Instagram Messenger will appear here when someone contacts your page</p>
                      </div>
                    ) : (
                      filteredConvos.map(convo => (
                        <button
                          key={convo.senderId}
                          onClick={() => {
                            setSelectedConvo(convo)
                            markConvoRead(convo.senderId)
                          }}
                          className={clsx(
                            'w-full text-left px-4 py-3 transition-colors hover:bg-slate-50',
                            selectedConvo?.senderId === convo.senderId && 'bg-blue-50 hover:bg-blue-50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={clsx(
                              'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5',
                              convo.source === 'instagram' ? 'bg-gradient-to-br from-pink-500 to-purple-600' : 'bg-blue-600'
                            )}>
                              <User size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className={clsx('text-sm font-semibold truncate', convo.unreadCount > 0 ? 'text-slate-900' : 'text-slate-700')}>
                                  {convo.source === 'instagram' ? '📷' : '📘'} {convo.senderId.slice(0, 10)}...
                                </p>
                                {convo.unreadCount > 0 && (
                                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    {convo.unreadCount}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 truncate mt-0.5">{convo.lastMessage || 'No text'}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {convo.lastTimestamp ? new Date(convo.lastTimestamp).toLocaleString() : ''}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* ── Message Thread ────────────────────────────── */}
                <div className={clsx("glass-card overflow-hidden flex-col w-full lg:w-auto", !selectedConvo ? "hidden lg:flex" : "flex")}>
                  {!selectedConvo ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                      <MessageSquare size={40} className="mb-3 opacity-20" />
                      <p className="font-semibold">Select a conversation</p>
                      <p className="text-sm mt-1">Click a conversation on the left to view messages</p>
                    </div>
                  ) : (
                    <>
                      {/* Thread header */}
                      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                        <button 
                          onClick={() => setSelectedConvo(null)} 
                          className="lg:hidden p-1.5 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ArrowLeft size={18} />
                        </button>
                        <div className={clsx(
                          'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold',
                          selectedConvo.source === 'instagram' ? 'bg-gradient-to-br from-pink-500 to-purple-600' : 'bg-blue-600'
                        )}>
                          <User size={13} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {selectedConvo.source === 'instagram' ? 'Instagram' : 'Facebook'} User
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">ID: {selectedConvo.senderId}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold',
                            selectedConvo.source === 'instagram' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                          )}>
                            {selectedConvo.source === 'instagram' ? '📷 Instagram DM' : '📘 Messenger'}
                          </span>
                          <span className="text-xs text-slate-400">{selectedConvo.messageCount} messages</span>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {[...selectedConvo.messages].reverse().map(msg => (
                          <div
                            key={msg.id}
                            className={clsx('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                          >
                            <div className={clsx(
                              'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
                              msg.direction === 'outbound'
                                ? 'bg-blue-600 text-white rounded-br-md'
                                : 'bg-slate-100 text-slate-800 rounded-bl-md'
                            )}>
                              <p className="leading-relaxed">{msg.text || <span className="italic opacity-60">[attachment]</span>}</p>
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {msg.attachments.map((att, i) => (
                                    att.url ? (
                                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                                        className={clsx('text-xs underline', msg.direction === 'outbound' ? 'text-blue-200' : 'text-blue-600')}>
                                        📎 {att.type || 'attachment'}
                                      </a>
                                    ) : null
                                  ))}
                                </div>
                              )}
                              <p className={clsx('text-[10px] mt-1', msg.direction === 'outbound' ? 'text-blue-200' : 'text-slate-400')}>
                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* No-reply notice */}
                      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                        <p className="text-xs text-slate-400 text-center">
                          Replies must be sent from your Facebook / Instagram page directly. Live viewing only.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </MainLayout>
  )
}
