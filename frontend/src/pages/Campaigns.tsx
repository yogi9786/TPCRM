import { useState, useEffect } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  Megaphone, Plus, Play, Pause, Trash2, Users, CheckCheck, Send, X,
  Clock, MessageCircle, Share2, RefreshCw, BarChart2, Calendar,
  ChevronDown, AlertCircle, Loader2, Zap, Target
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

const API = import.meta.env.VITE_API_URL || 'https://tpcrm.onrender.com'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-violet-100 text-violet-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  paused: 'bg-amber-100 text-amber-700',
}

const TYPE_STYLE: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  whatsapp_broadcast: { label: 'WhatsApp Broadcast', icon: <MessageCircle size={12} />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  meta_retarget: { label: 'Meta Retarget', icon: <Share2 size={12} />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  email_blast: { label: 'Email Blast', icon: <Send size={12} />, color: 'text-violet-600 bg-violet-50 border-violet-200' },
}

const TARGET_STATUSES = ['All', 'New', 'Contacted', 'Qualified', 'Closed', 'Lost']
const TARGET_SOURCES = ['All', 'Facebook Ads', 'Instagram Ads', 'WhatsApp', 'Website', 'Referral', 'Walk-in']

const EMPTY_FORM = {
  name: '',
  message: '',
  targetStatus: 'All',
  targetSource: 'All',
  campaignType: 'whatsapp_broadcast',
  scheduledAt: '',
}

export default function Campaigns() {
  const { currentUser } = useAuth()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showLaunchModal, setShowLaunchModal] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [launching, setLaunching] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'campaigns'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setCampaigns(data)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  async function createCampaign() {
    if (!form.name.trim() || !form.message.trim()) return toast.error('Name and message required')
    setSaving(true)
    try {
      const status = form.scheduledAt ? 'scheduled' : 'draft'
      await addDoc(collection(db, 'campaigns'), {
        ...form,
        scheduledAt: form.scheduledAt || null,
        status,
        targetCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
        userId: currentUser!.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      toast.success(status === 'scheduled' ? '📅 Campaign scheduled!' : '✅ Campaign created as draft!')
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch {
      toast.error('Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  async function launchCampaign(campaignId: string) {
    setLaunching(campaignId)
    setShowLaunchModal(null)
    try {
      const token = await currentUser!.getIdToken()
      const res = await fetch(`${API}/campaigns/${campaignId}/launch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      toast.success(`🚀 Campaign launched! Sent to ${data.sentCount}/${data.targetCount} leads`)
    } catch (e: any) {
      toast.error(e.message || 'Launch failed')
    } finally {
      setLaunching(null)
    }
  }

  async function updateStatus(id: string, status: string) {
    await updateDoc(doc(db, 'campaigns', id), { status, updatedAt: new Date().toISOString() })
    toast.success(`Campaign ${status}`)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign?')) return
    await deleteDoc(doc(db, 'campaigns', id))
    toast.success('Campaign deleted')
  }

  const filtered = filterType === 'all' ? campaigns : campaigns.filter(c => c.campaignType === filterType)

  const totalSent = campaigns.reduce((a, c) => a + (c.sentCount || 0), 0)
  const totalScheduled = campaigns.filter(c => c.status === 'scheduled').length

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Megaphone className="text-orange-500" size={22} /> Campaigns
            </h1>
            <p className="page-subtitle">Broadcast messages to your leads across channels</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto" id="create-campaign-btn">
            <Plus size={15} /> New Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: campaigns.length, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
            { label: 'Draft', value: campaigns.filter(c => c.status === 'draft').length, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Scheduled', value: totalScheduled, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
            { label: 'Completed', value: campaigns.filter(c => c.status === 'completed').length, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Total Sent', value: totalSent.toLocaleString(), color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`glass-card p-4 border ${border} ${bg}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[
            { id: 'all', label: 'All', icon: <Megaphone size={13} /> },
            { id: 'whatsapp_broadcast', label: 'WhatsApp', icon: <MessageCircle size={13} /> },
            { id: 'meta_retarget', label: 'Meta Retarget', icon: <Share2 size={13} /> },
            { id: 'email_blast', label: 'Email', icon: <Send size={13} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap',
                filterType === tab.id
                  ? 'border-orange-500 text-orange-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              )}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Campaigns list */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 text-slate-500">
            <Megaphone size={40} className="mb-3 opacity-20" />
            <p className="font-semibold">No campaigns yet</p>
            <p className="text-sm text-slate-400 mt-1">Create your first broadcast campaign</p>
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4 text-sm">
              <Plus size={13} /> New Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c: any) => {
              const typeInfo = TYPE_STYLE[c.campaignType] || TYPE_STYLE.whatsapp_broadcast
              const isLaunching = launching === c.id
              const target = Math.max(c.targetCount || 1, 1)
              const deliveryPct = c.sentCount > 0 ? Math.round((c.deliveredCount || c.sentCount) / c.sentCount * 100) : 0

              return (
                <div key={c.id} className="glass-card p-5 border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_STYLE[c.status] || STATUS_STYLE.draft)}>
                          {c.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                          {c.status}
                        </span>
                        <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', typeInfo.color)}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                      </div>

                      {/* Message preview */}
                      <p className="text-xs text-slate-500 truncate mb-2 max-w-2xl">{c.message}</p>

                      {/* Target info */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Target size={11} />
                          Target: {c.targetStatus !== 'All' ? c.targetStatus : 'All'} leads
                          {c.targetSource && c.targetSource !== 'All' && ` from ${c.targetSource}`}
                        </span>
                        <span className="flex items-center gap-1"><Users size={11} /> {c.targetCount} targeted</span>
                        <span className="flex items-center gap-1"><Send size={11} /> {c.sentCount} sent</span>
                        <span className="flex items-center gap-1"><CheckCheck size={11} /> {c.deliveredCount || 0} delivered</span>
                        {c.scheduledAt && (
                          <span className="flex items-center gap-1 text-violet-600 font-medium">
                            <Clock size={11} /> Scheduled: {new Date(c.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        )}
                      </div>

                      {/* Delivery progress bar */}
                      {c.sentCount > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Delivery progress</span>
                            <span className="font-semibold text-emerald-600">{deliveryPct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                              style={{ width: `${deliveryPct}%` }}
                            />
                          </div>
                          <div className="flex gap-4 text-[10px] text-slate-400 pt-0.5">
                            <span className="text-blue-600 font-semibold">{c.sentCount} sent</span>
                            <span className="text-emerald-600 font-semibold">{c.deliveredCount || 0} delivered</span>
                            <span className="text-purple-600 font-semibold">{c.readCount || 0} read</span>
                            {c.failedCount > 0 && <span className="text-red-500 font-semibold">{c.failedCount} failed</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.status === 'draft' && (
                        <button
                          onClick={() => setShowLaunchModal(c.id)}
                          disabled={isLaunching}
                          className="btn-primary py-2 text-xs"
                        >
                          {isLaunching
                            ? <><Loader2 size={12} className="animate-spin" /> Launching…</>
                            : <><Play size={12} /> Launch</>
                          }
                        </button>
                      )}
                      {c.status === 'scheduled' && (
                        <button
                          onClick={() => setShowLaunchModal(c.id)}
                          disabled={isLaunching}
                          className="btn-primary py-2 text-xs bg-violet-600 hover:bg-violet-700"
                        >
                          <Zap size={12} /> Send Now
                        </button>
                      )}
                      {c.status === 'running' && (
                        <button onClick={() => updateStatus(c.id, 'paused')} className="btn-secondary py-2 text-xs">
                          <Pause size={12} /> Pause
                        </button>
                      )}
                      {c.status === 'paused' && (
                        <button onClick={() => setShowLaunchModal(c.id)} className="btn-primary py-2 text-xs">
                          <Play size={12} /> Resume
                        </button>
                      )}
                      <button onClick={() => deleteCampaign(c.id)} className="btn-danger py-2 px-2.5 text-xs">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create Campaign Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">New Campaign</h2>
                <p className="text-xs text-slate-500">Configure your broadcast settings</p>
              </div>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }} className="text-slate-400 hover:text-slate-900 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Campaign Type */}
            <div>
              <label className="label">Campaign Type</label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TYPE_STYLE).map(([key, { label, icon, color }]) => (
                  <button
                    key={key}
                    onClick={() => setForm(f => ({ ...f, campaignType: key }))}
                    className={clsx(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all',
                      form.campaignType === key
                        ? `${color} border-current`
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    {icon}
                    <span className="text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="label">Campaign Name *</label>
              <input
                className="input-field"
                placeholder="e.g. Summer Promo 2025"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Target Filters */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Target Status</label>
                <select className="select-field" value={form.targetStatus} onChange={e => setForm(f => ({ ...f, targetStatus: e.target.value }))}>
                  {TARGET_STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Target Source</label>
                <select className="select-field" value={form.targetSource} onChange={e => setForm(f => ({ ...f, targetSource: e.target.value }))}>
                  {TARGET_SOURCES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>)}
                </select>
              </div>
            </div>

            {/* Schedule */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Calendar size={13} className="text-violet-500" /> Schedule (optional)
              </label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              />
              {form.scheduledAt && (
                <p className="text-xs text-violet-600 mt-1 font-medium">
                  📅 Will be scheduled — launch manually or it sends at the set time
                </p>
              )}
            </div>

            {/* Message */}
            <div>
              <label className="label">Message *</label>
              <textarea
                className="input-field resize-none"
                rows={4}
                placeholder={
                  form.campaignType === 'whatsapp_broadcast'
                    ? 'Hi {{name}}, we have an exciting offer for you...'
                    : form.campaignType === 'meta_retarget'
                    ? 'Retarget your Meta audience with this message...'
                    : 'Dear {{name}}, we would like to share...'
                }
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">Use {'{{name}}'} for personalization</p>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }} className="btn-secondary">Cancel</button>
              <button onClick={createCampaign} disabled={saving} className="btn-primary">
                {saving ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : form.scheduledAt ? '📅 Schedule Campaign' : '✅ Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Launch Confirmation Modal ─────────────────────────────────────── */}
      {showLaunchModal && (() => {
        const camp = campaigns.find(c => c.id === showLaunchModal)
        if (!camp) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="glass-card w-full max-w-sm p-6 space-y-4 border-slate-200 animate-slide-up text-center">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
                <Megaphone size={24} className="text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Launch Campaign?</h3>
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">"{camp.name}"</span> will immediately send WhatsApp messages to all matching leads.
              </p>
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 text-left space-y-1">
                <p><span className="font-semibold">Type:</span> {TYPE_STYLE[camp.campaignType]?.label || camp.campaignType}</p>
                <p><span className="font-semibold">Target status:</span> {camp.targetStatus || 'All'}</p>
                <p><span className="font-semibold">Target source:</span> {camp.targetSource || 'All'}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                This action cannot be undone. Messages will be sent immediately.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLaunchModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => launchCampaign(showLaunchModal)} className="btn-primary flex-1">
                  <Play size={13} /> Launch Now
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </MainLayout>
  )
}
