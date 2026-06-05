import { useState, useEffect } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  Briefcase, Plus, Search, DollarSign, Calendar, MoreVertical, Edit2, Trash2, X
} from 'lucide-react'
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STAGES = ['Lead', 'Contacted', 'Proposal', 'Won', 'Lost']

export default function Deals() {
  const { currentUser } = useAuth()
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ title: '', value: 0, stage: 'Lead', expectedCloseDate: '', notes: '' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'deals'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setDeals(data)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  function openAdd() {
    setEditItem(null)
    setForm({ title: '', value: 0, stage: 'Lead', expectedCloseDate: '', notes: '' })
    setShowModal(true)
  }

  function openEdit(d: any) {
    setEditItem(d)
    setForm({ title: d.title, value: d.value, stage: d.stage, expectedCloseDate: d.expectedCloseDate || '', notes: d.notes || '' })
    setShowModal(true)
  }

  async function save() {
    if (!form.title) return toast.error('Title is required')
    try {
      const payload = { ...form, userId: currentUser!.uid }
      if (editItem) {
        await updateDoc(doc(db, 'deals', editItem.id), payload)
        toast.success('Deal updated')
      } else {
        await addDoc(collection(db, 'deals'), { ...payload, createdAt: new Date().toISOString() })
        toast.success('Deal created')
      }
      setShowModal(false)
    } catch { toast.error('Failed to save') }
  }

  async function deleteDeal(id: string) {
    if (!confirm('Delete this deal?')) return
    await deleteDoc(doc(db, 'deals', id))
    toast.success('Deleted')
  }

  async function updateStage(id: string, stage: string) {
    await updateDoc(doc(db, 'deals', id), { stage })
  }

  const filtered = deals.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                <Briefcase size={18} className="text-white" />
              </span>
              Deals Pipeline
            </h1>
            <p className="page-subtitle">Track your revenue and sales opportunities</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9 h-10 text-sm w-48"
                placeholder="Search deals..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={openAdd} className="btn-primary whitespace-nowrap"><Plus size={15}/> New Deal</button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageDeals = filtered.filter(d => d.stage === stage)
            const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.value), 0)
            return (
              <div key={stage} className="bg-slate-100/50 rounded-2xl border border-slate-200/60 p-3 min-w-[280px] w-full max-w-[320px] flex flex-col">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-bold text-slate-700 text-sm">{stage}</h3>
                  <span className="text-xs font-bold bg-white text-slate-500 px-2 py-0.5 rounded-full shadow-sm">
                    ${stageTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {stageDeals.map(d => (
                    <div key={d.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-200/60 hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group" onClick={() => openEdit(d)}>
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-sm text-slate-800 line-clamp-1">{d.title}</p>
                        <button onClick={(e) => { e.stopPropagation(); deleteDeal(d.id) }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={12}/>
                        </button>
                      </div>
                      <p className="text-emerald-600 font-bold text-xs mb-2">${Number(d.value).toLocaleString()}</p>
                      {d.expectedCloseDate && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Calendar size={10} /> {d.expectedCloseDate}
                        </div>
                      )}
                      {/* Quick move buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {STAGES.map(s => (
                          s !== stage && <button key={s} onClick={() => updateStage(d.id, s)} className="text-[9px] bg-slate-50 hover:bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">{s}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl h-20 flex items-center justify-center text-slate-400 text-xs font-medium">
                      Drop deals here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="font-bold text-lg">{editItem ? 'Edit Deal' : 'New Deal'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Title</label><input className="input-field" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Value ($)</label><input type="number" className="input-field" value={form.value} onChange={e=>setForm({...form, value: Number(e.target.value)})} /></div>
                <div><label className="label">Stage</label><select className="select-field" value={form.stage} onChange={e=>setForm({...form, stage: e.target.value})}>{STAGES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="label">Expected Close Date</label><input type="date" className="input-field" value={form.expectedCloseDate} onChange={e=>setForm({...form, expectedCloseDate: e.target.value})} /></div>
              <div><label className="label">Notes</label><textarea className="textarea-field" rows={3} value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} /></div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save Deal</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
