import { useState, useEffect } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  Workflow, Plus, Search, Play, Pause, Edit2, Trash2, X, Zap
} from 'lucide-react'
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Automations() {
  const { currentUser } = useAuth()
  const [automations, setAutomations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', trigger: 'Lead Created', action: 'Send Email' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'automations'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAutomations(data)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  function openAdd() {
    setForm({ name: '', trigger: 'Lead Created', action: 'Send Email' })
    setShowModal(true)
  }

  async function save() {
    if (!form.name) return toast.error('Name required')
    try {
      const payload = {
        name: form.name,
        trigger: form.trigger,
        actions: [{ type: form.action }],
        isActive: true,
        userId: currentUser!.uid,
      }
      await addDoc(collection(db, 'automations'), { ...payload, createdAt: new Date().toISOString() })
      toast.success('Automation created')
      setShowModal(false)
    } catch { toast.error('Failed to save') }
  }

  async function deleteAuto(id: string) {
    if (!confirm('Delete automation?')) return
    await deleteDoc(doc(db, 'automations', id))
    toast.success('Deleted')
  }

  async function toggleActive(id: string, current: boolean) {
    await updateDoc(doc(db, 'automations', id), { isActive: !current })
  }

  const filtered = automations.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                <Workflow size={18} className="text-white" />
              </span>
              Automations
            </h1>
            <p className="page-subtitle">Build powerful workflows to save time</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openAdd} className="btn-primary whitespace-nowrap"><Plus size={15}/> Create Workflow</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div key={a.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-all group relative">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{a.name}</h3>
                <button onClick={() => toggleActive(a.id, a.isActive)} className={clsx(
                  "p-1.5 rounded-lg border transition-all",
                  a.isActive ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-slate-50 border-slate-200 text-slate-400"
                )}>
                  {a.isActive ? <Play size={14}/> : <Pause size={14}/>}
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-violet-500"><Zap size={14}/></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">When</p>
                    <p className="text-sm font-semibold text-slate-700">{a.trigger}</p>
                  </div>
                </div>
                <div className="w-0.5 h-4 bg-slate-200 ml-[5px]"></div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-blue-500"><Workflow size={14}/></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Then</p>
                    <p className="text-sm font-semibold text-slate-700">{a.actions?.[0]?.type || 'Unknown Action'}</p>
                  </div>
                </div>
              </div>

              <button onClick={() => deleteAuto(a.id)} className="absolute bottom-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={16}/>
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <Workflow size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold">No workflows created</p>
              <p className="text-sm">Automate your repetitive tasks today.</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="font-bold text-lg">New Automation</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Workflow Name</label><input className="input-field" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} /></div>
              <div>
                <label className="label">Trigger</label>
                <select className="select-field" value={form.trigger} onChange={e=>setForm({...form, trigger: e.target.value})}>
                  <option>Lead Created</option>
                  <option>Deal Won</option>
                  <option>Email Received</option>
                  <option>WhatsApp Message Received</option>
                </select>
              </div>
              <div>
                <label className="label">Action</label>
                <select className="select-field" value={form.action} onChange={e=>setForm({...form, action: e.target.value})}>
                  <option>Send Email</option>
                  <option>Send WhatsApp</option>
                  <option>Create Task</option>
                  <option>Notify Team</option>
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Create Workflow</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
