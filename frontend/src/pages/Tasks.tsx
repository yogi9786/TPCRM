import { useState, useEffect } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  CheckSquare, Plus, Search, Calendar, AlertCircle, Edit2, Trash2, X
} from 'lucide-react'
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const STATUSES = ['Pending', 'In Progress', 'Completed']
const PRIORITIES = ['Low', 'Medium', 'High']

export default function Tasks() {
  const { currentUser } = useAuth()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'Medium', status: 'Pending' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'tasks'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTasks(data)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  function openAdd() {
    setEditItem(null)
    setForm({ title: '', description: '', dueDate: '', priority: 'Medium', status: 'Pending' })
    setShowModal(true)
  }

  function openEdit(t: any) {
    setEditItem(t)
    setForm({ title: t.title, description: t.description || '', dueDate: t.dueDate || '', priority: t.priority, status: t.status })
    setShowModal(true)
  }

  async function save() {
    if (!form.title) return toast.error('Title is required')
    try {
      const payload = { ...form, userId: currentUser!.uid }
      if (editItem) {
        await updateDoc(doc(db, 'tasks', editItem.id), payload)
        toast.success('Task updated')
      } else {
        await addDoc(collection(db, 'tasks'), { ...payload, createdAt: new Date().toISOString() })
        toast.success('Task created')
      }
      setShowModal(false)
    } catch { toast.error('Failed to save') }
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete task?')) return
    await deleteDoc(doc(db, 'tasks', id))
    toast.success('Deleted')
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === 'Completed' ? 'Pending' : 'Completed'
    await updateDoc(doc(db, 'tasks', id), { status: next })
  }

  const filtered = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <CheckSquare size={18} className="text-white" />
              </span>
              Tasks & Activities
            </h1>
            <p className="page-subtitle">Manage your daily to-dos and follow-ups</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9 h-10 text-sm w-48"
                placeholder="Search tasks..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={openAdd} className="btn-primary whitespace-nowrap"><Plus size={15}/> Add Task</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className={clsx(
                "flex items-center gap-4 p-3 rounded-xl border hover:shadow-sm transition-all group",
                t.status === 'Completed' ? "bg-slate-50 border-slate-200/60" : "bg-white border-slate-200 hover:border-blue-300"
              )}>
                <button onClick={() => toggleStatus(t.id, t.status)} className={clsx(
                  "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all",
                  t.status === 'Completed' ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 text-transparent hover:border-blue-400"
                )}>
                  <CheckSquare size={12} />
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(t)}>
                  <p className={clsx("font-semibold text-sm", t.status === 'Completed' ? "text-slate-400 line-through" : "text-slate-800")}>{t.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px]">
                    {t.dueDate && <span className="flex items-center gap-1 text-slate-500"><Calendar size={10} /> {t.dueDate}</span>}
                    <span className={clsx(
                      "flex items-center gap-1 font-bold",
                      t.priority === 'High' ? "text-red-500" : t.priority === 'Medium' ? "text-amber-500" : "text-emerald-500"
                    )}><AlertCircle size={10} /> {t.priority}</span>
                  </div>
                </div>
                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                  <button onClick={() => openEdit(t)} className="p-1.5 text-slate-400 hover:text-blue-500"><Edit2 size={14}/></button>
                  <button onClick={() => deleteTask(t.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-10 text-slate-500">No tasks found. Get things done!</div>}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="font-bold text-lg">{editItem ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Title</label><input className="input-field" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} /></div>
              <div><label className="label">Description</label><textarea className="textarea-field" rows={2} value={form.description} onChange={e=>setForm({...form, description: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Due Date</label><input type="date" className="input-field" value={form.dueDate} onChange={e=>setForm({...form, dueDate: e.target.value})} /></div>
                <div><label className="label">Priority</label><select className="select-field" value={form.priority} onChange={e=>setForm({...form, priority: e.target.value})}>{PRIORITIES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="label">Status</label><select className="select-field" value={form.status} onChange={e=>setForm({...form, status: e.target.value})}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save Task</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
