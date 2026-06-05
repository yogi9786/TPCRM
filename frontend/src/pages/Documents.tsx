import { useState, useEffect } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  FileText, Plus, Search, Download, Trash2, X, File, FileSignature, FileSpreadsheet
} from 'lucide-react'
import { collection, query, where, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const TYPES = ['Proposal', 'Invoice', 'Contract', 'Other']

export default function Documents() {
  const { currentUser } = useAuth()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'Proposal', fileUrl: '' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'documents'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setDocuments(data)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  function openAdd() {
    setForm({ title: '', type: 'Proposal', fileUrl: '' })
    setShowModal(true)
  }

  async function save() {
    if (!form.title || !form.fileUrl) return toast.error('Title and File URL are required')
    try {
      const payload = { ...form, userId: currentUser!.uid }
      await addDoc(collection(db, 'documents'), { ...payload, createdAt: new Date().toISOString() })
      toast.success('Document added')
      setShowModal(false)
    } catch { toast.error('Failed to save') }
  }

  async function deleteDocRecord(id: string) {
    if (!confirm('Delete document?')) return
    await deleteDoc(doc(db, 'documents', id))
    toast.success('Deleted')
  }

  const filtered = documents.filter(d => d.title.toLowerCase().includes(search.toLowerCase()))

  function getIcon(type: string) {
    if (type === 'Invoice') return <FileSpreadsheet size={16} className="text-emerald-500" />
    if (type === 'Contract') return <FileSignature size={16} className="text-amber-500" />
    return <FileText size={16} className="text-blue-500" />
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-md">
                <FileText size={18} className="text-white" />
              </span>
              Documents
            </h1>
            <p className="page-subtitle">Store and manage proposals, invoices, and contracts</p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field pl-9 h-10 text-sm w-48"
                placeholder="Search documents..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button onClick={openAdd} className="btn-primary whitespace-nowrap"><Plus size={15}/> Add File</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(d => (
            <div key={d.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 hover:shadow-md hover:border-slate-300 transition-all group relative flex flex-col">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                  {getIcon(d.type)}
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className="font-bold text-sm text-slate-800 line-clamp-2">{d.title}</p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{d.type}</p>
                </div>
              </div>
              
              <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800">
                  <Download size={12} /> Open File
                </a>
                <button onClick={() => deleteDocRecord(d.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <File size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold">No documents found</p>
              <p className="text-sm">Upload invoices, proposals, and contracts here.</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="font-bold text-lg">Add Document</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Document Title</label><input className="input-field" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} /></div>
              <div>
                <label className="label">Type</label>
                <select className="select-field" value={form.type} onChange={e=>setForm({...form, type: e.target.value})}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">File URL (Google Drive, Dropbox, etc)</label>
                <input className="input-field" placeholder="https://..." value={form.fileUrl} onChange={e=>setForm({...form, fileUrl: e.target.value})} />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save Document</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
