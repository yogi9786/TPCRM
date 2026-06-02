import { useState } from 'react'
import MainLayout from '../layouts/MainLayout'
import { Megaphone, Plus, Play, Pause, Trash2, Users, CheckCheck, Send, Clock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-700/50 text-slate-700',
  running: 'bg-sky-500/15 text-sky-300',
  completed: 'bg-emerald-500/15 text-emerald-300',
  failed: 'bg-red-500/15 text-red-300',
  paused: 'bg-amber-500/15 text-amber-300',
}

export default function Campaigns() {
  const { currentUser } = useAuth()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', message: '', targetStatus: 'New' })
  const [saving, setSaving] = useState(false)

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
    if (!form.name || !form.message) return toast.error('Name and message required')
    setSaving(true)
    try {
      await addDoc(collection(db, 'campaigns'), {
        ...form,
        status: 'draft',
        targetCount: 0,
        sentCount: 0,
        deliveredCount: 0,
        readCount: 0,
        failedCount: 0,
        userId: currentUser!.uid,
        createdAt: new Date().toISOString(),
      })
      toast.success('Campaign created!')
      setShowModal(false)
      setForm({ name: '', message: '', targetStatus: 'New' })
    } catch {
      toast.error('Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    await updateDoc(doc(db, 'campaigns', id), { status })
    toast.success(`Campaign ${status}`)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign?')) return
    await deleteDoc(doc(db, 'campaigns', id))
    toast.success('Campaign deleted')
  }

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Megaphone className="text-orange-400" size={24} /> Campaigns
            </h1>
            <p className="page-subtitle">Broadcast WhatsApp messages to your leads</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary" id="create-campaign-btn">
            <Plus size={15} /> New Campaign
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Campaigns', value: campaigns.length, color: 'text-orange-400', border: 'border-orange-500/20' },
            { label: 'Running', value: campaigns.filter(c => c.status === 'running').length, color: 'text-blue-700', border: 'border-sky-500/20' },
            { label: 'Completed', value: campaigns.filter(c => c.status === 'completed').length, color: 'text-emerald-400', border: 'border-emerald-500/20' },
            { label: 'Total Sent', value: campaigns.reduce((a, c) => a + (c.sentCount || 0), 0), color: 'text-violet-400', border: 'border-violet-500/20' },
          ].map(({ label, value, color, border }) => (
            <div key={label} className={`glass-card p-5 border ${border}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Campaigns list */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 text-slate-600">
            <Megaphone size={40} className="mb-3 opacity-30" />
            <p className="font-medium">No campaigns yet</p>
            <p className="text-sm mt-1">Create your first broadcast campaign</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c: any) => (
              <div key={c.id} className="glass-card p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', STATUS_STYLE[c.status] || STATUS_STYLE.draft)}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mb-3">{c.message}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users size={12} /> {c.targetCount} targets</span>
                      <span className="flex items-center gap-1"><Send size={12} /> {c.sentCount} sent</span>
                      <span className="flex items-center gap-1"><CheckCheck size={12} /> {c.deliveredCount} delivered</span>
                    </div>
                    {c.sentCount > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Delivery rate</span>
                          <span>{c.targetCount > 0 ? Math.round((c.deliveredCount / c.sentCount) * 100) : 0}%</span>
                        </div>
                        <div className="h-1.5 bg-white rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${c.targetCount > 0 ? (c.deliveredCount / c.sentCount) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.status === 'draft' && (
                      <button onClick={() => updateStatus(c.id, 'running')} className="btn-primary py-2 text-xs">
                        <Play size={13} /> Launch
                      </button>
                    )}
                    {c.status === 'running' && (
                      <button onClick={() => updateStatus(c.id, 'paused')} className="btn-secondary py-2 text-xs">
                        <Pause size={13} /> Pause
                      </button>
                    )}
                    {c.status === 'paused' && (
                      <button onClick={() => updateStatus(c.id, 'running')} className="btn-primary py-2 text-xs">
                        <Play size={13} /> Resume
                      </button>
                    )}
                    <button onClick={() => deleteCampaign(c.id)} className="btn-danger py-2 text-xs">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 space-y-4 border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">New Campaign</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div>
              <label className="label">Campaign Name</label>
              <input className="input-field" placeholder="e.g. Summer Promo 2024" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Target Leads (Status)</label>
              <select className="select-field" value={form.targetStatus} onChange={e => setForm(f => ({ ...f, targetStatus: e.target.value }))}>
                {['New', 'Contacted', 'Qualified', 'All'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Message</label>
              <textarea className="input-field resize-none" rows={4} placeholder="Hi {{name}}, ..." value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={createCampaign} disabled={saving} className="btn-primary">
                {saving ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
