import { useState, useEffect, useMemo } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  CalendarDays, LayoutList, Plus, X, Edit2, Trash2,
  Send, Clock, CheckCircle2, Archive, MessageCircle, Mail,
  Share2, Instagram, Smartphone, Tag, ChevronLeft, ChevronRight,
  Search, Megaphone, MoreVertical, Sparkles, Zap, TrendingUp, FileText
} from 'lucide-react'
import {
  collection, query, where, onSnapshot,
  addDoc, doc, updateDoc, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// ─── Types ───────────────────────────────────────────────────────────────────
interface ContentPlan {
  id: string
  title: string
  body: string
  platform: string
  contentType: string
  status: string
  scheduledAt?: string
  tags?: string[]
  targetAudience?: string
  notes?: string
  createdAt: string
}

// ─── Platform config with rich colors ────────────────────────────────────────
const PLATFORMS = [
  {
    value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle,
    gradient: 'from-green-500 to-emerald-600',
    pill: 'bg-green-500/10 text-green-700 border border-green-500/20',
    calChip: 'bg-green-500 text-white',
    dot: 'bg-green-500',
  },
  {
    value: 'email', label: 'Email', icon: Mail,
    gradient: 'from-blue-500 to-indigo-600',
    pill: 'bg-blue-500/10 text-blue-700 border border-blue-500/20',
    calChip: 'bg-blue-500 text-white',
    dot: 'bg-blue-500',
  },
  {
    value: 'meta', label: 'Meta Ads', icon: Share2,
    gradient: 'from-indigo-500 to-violet-600',
    pill: 'bg-violet-500/10 text-violet-700 border border-violet-500/20',
    calChip: 'bg-violet-500 text-white',
    dot: 'bg-violet-500',
  },
  {
    value: 'instagram', label: 'Instagram', icon: Instagram,
    gradient: 'from-pink-500 to-rose-500',
    pill: 'bg-pink-500/10 text-pink-700 border border-pink-500/20',
    calChip: 'bg-pink-500 text-white',
    dot: 'bg-pink-500',
  },
  {
    value: 'sms', label: 'SMS', icon: Smartphone,
    gradient: 'from-amber-500 to-orange-500',
    pill: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',
    calChip: 'bg-amber-500 text-white',
    dot: 'bg-amber-500',
  },
]

const CONTENT_TYPES = ['Post', 'Story', 'Reel', 'Email', 'WhatsApp Blast', 'SMS', 'Ad Copy', 'Newsletter']

const STATUS_CONFIG: Record<string, {
  label: string; icon: React.ElementType
  pill: string; dot: string; ring: string
}> = {
  draft:     { label: 'Draft',     icon: FileText,     pill: 'bg-slate-500/10 text-slate-600 border border-slate-300/50',      dot: 'bg-slate-400', ring: 'ring-slate-200' },
  scheduled: { label: 'Scheduled', icon: Clock,        pill: 'bg-amber-500/10 text-amber-700 border border-amber-400/30',      dot: 'bg-amber-400', ring: 'ring-amber-200' },
  published: { label: 'Published', icon: CheckCircle2, pill: 'bg-emerald-500/10 text-emerald-700 border border-emerald-400/30', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  archived:  { label: 'Archived',  icon: Archive,      pill: 'bg-slate-400/10 text-slate-500 border border-slate-300/40',      dot: 'bg-slate-300', ring: 'ring-slate-100' },
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getPlatform(value: string) {
  return PLATFORMS.find(p => p.value === value) || PLATFORMS[0]
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const EMPTY_FORM = {
  title: '', body: '', platform: 'whatsapp', contentType: 'Post',
  status: 'draft', scheduledAt: '', tags: '', targetAudience: 'All', notes: '',
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function ContentPlanner() {
  const { currentUser } = useAuth()
  const [plans, setPlans] = useState<ContentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<ContentPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [calMonth, setCalMonth] = useState(new Date())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'content_plans'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentPlan))
      data.sort((a, b) => (a.scheduledAt || a.createdAt) < (b.scheduledAt || b.createdAt) ? -1 : 1)
      setPlans(data)
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  const filtered = useMemo(() => plans.filter(p => {
    if (filterPlatform !== 'all' && p.platform !== filterPlatform) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      return p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)
    }
    return true
  }), [plans, filterPlatform, filterStatus, search])

  const calDays = useMemo(() => {
    const year = calMonth.getFullYear(), month = calMonth.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const days: (Date | null)[] = Array(first.getDay()).fill(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }, [calMonth])

  function plansForDay(date: Date) {
    return plans.filter(p => {
      if (!p.scheduledAt) return false
      const d = new Date(p.scheduledAt)
      return d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() && d.getDate() === date.getDate()
    })
  }

  function openAdd(defaultDate?: string) {
    setEditItem(null)
    setForm({ ...EMPTY_FORM, scheduledAt: defaultDate || '' })
    setShowModal(true)
  }

  function openEdit(plan: ContentPlan) {
    setEditItem(plan)
    setForm({
      title: plan.title, body: plan.body, platform: plan.platform,
      contentType: plan.contentType, status: plan.status,
      scheduledAt: plan.scheduledAt ? plan.scheduledAt.slice(0, 16) : '',
      tags: (plan.tags || []).join(', '),
      targetAudience: plan.targetAudience || 'All', notes: plan.notes || '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) return toast.error('Title and content are required')
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(), body: form.body.trim(),
        platform: form.platform, contentType: form.contentType, status: form.status,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        targetAudience: form.targetAudience, notes: form.notes,
        userId: currentUser!.uid, updatedAt: new Date().toISOString(),
      }
      if (editItem) {
        await updateDoc(doc(db, 'content_plans', editItem.id), payload)
        toast.success('Content updated!')
      } else {
        await addDoc(collection(db, 'content_plans'), { ...payload, createdAt: new Date().toISOString() })
        toast.success('Content planned!')
      }
      setShowModal(false)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this content plan?')) return
    await deleteDoc(doc(db, 'content_plans', id))
    toast.success('Deleted')
  }

  async function updateStatus(id: string, status: string) {
    await updateDoc(doc(db, 'content_plans', id), { status, updatedAt: new Date().toISOString() })
    toast.success(`Marked as ${status}`)
    setOpenMenuId(null)
  }

  const stats = useMemo(() => ({
    total: plans.length,
    draft: plans.filter(p => p.status === 'draft').length,
    scheduled: plans.filter(p => p.status === 'scheduled').length,
    published: plans.filter(p => p.status === 'published').length,
  }), [plans])

  const today = new Date()

  // ── Upcoming
  const upcoming = useMemo(() =>
    plans.filter(p => p.scheduledAt && new Date(p.scheduledAt) >= today && p.status !== 'published').slice(0, 6),
  [plans])

  return (
    <MainLayout>
      <div className="space-y-7 animate-fade-in">

        {/* ══ HERO HEADER ══════════════════════════════════════════════════════ */}
        <div
          className="relative overflow-hidden rounded-2xl p-6 md:p-8"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)',
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 left-16 w-40 h-40 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA2KSIvPjwvZz48L3N2Zz4=')] opacity-60 pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <CalendarDays size={20} className="text-white" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-violet-300">Content Planner</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight font-['Outfit'] leading-tight">
                Plan & Schedule Content
              </h1>
              <p className="text-violet-200/80 text-sm mt-1 font-medium">
                Orchestrate your campaigns across WhatsApp, Email, Meta & more
              </p>

              {/* Inline mini stats */}
              <div className="flex flex-wrap items-center gap-4 mt-4">
                {[
                  { label: 'Total', val: stats.total, color: 'text-white' },
                  { label: 'Drafts', val: stats.draft, color: 'text-slate-300' },
                  { label: 'Scheduled', val: stats.scheduled, color: 'text-amber-300' },
                  { label: 'Published', val: stats.published, color: 'text-emerald-300' },
                ].map(s => (
                  <div key={s.label} className="flex items-baseline gap-1.5">
                    <span className={`text-xl font-black ${s.color}`}>{s.val}</span>
                    <span className="text-[11px] text-white/50 font-medium">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-3">
              {/* View Toggle */}
              <div className="flex bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/10 self-start sm:self-auto">
                {(['calendar', 'list'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    id={`view-${v}-btn`}
                    className={clsx(
                      'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all',
                      view === v
                        ? 'bg-white text-slate-900 shadow-lg'
                        : 'text-white/60 hover:text-white'
                    )}
                  >
                    {v === 'calendar' ? <CalendarDays size={13} /> : <LayoutList size={13} />}
                    {v === 'calendar' ? 'Calendar' : 'List'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => openAdd()}
                id="add-content-btn"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-violet-700 font-bold text-sm shadow-xl hover:bg-violet-50 active:scale-95 transition-all"
              >
                <Plus size={16} />
                New Content
              </button>
            </div>
          </div>
        </div>

        {/* ══ FILTER BAR ═══════════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="content-search"
              className="input-field pl-10 h-10 text-sm"
              placeholder="Search titles, content…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Platform pills filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-shrink-0">
            <button
              onClick={() => setFilterPlatform('all')}
              className={clsx(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                filterPlatform === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              )}
            >All</button>
            {PLATFORMS.map(p => (
              <button
                key={p.value}
                onClick={() => setFilterPlatform(filterPlatform === p.value ? 'all' : p.value)}
                className={clsx(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                  filterPlatform === p.value
                    ? `bg-gradient-to-r ${p.gradient} text-white border-transparent shadow-sm`
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                )}
              >
                <p.icon size={11} /> {p.label}
              </button>
            ))}
          </div>

          <select
            id="filter-status"
            className="select-field h-10 text-sm flex-shrink-0 sm:w-36"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* ══ CALENDAR VIEW ════════════════════════════════════════════════════ */}
        {view === 'calendar' && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">

            {/* Calendar grid */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_20px_rgba(0,0,0,0.06)] overflow-hidden">

              {/* Month nav */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                  id="cal-prev-month"
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all"
                ><ChevronLeft size={16} /></button>
                <div className="text-center">
                  <h2 className="font-black text-slate-900 text-base font-['Outfit']">
                    {MONTHS[calMonth.getMonth()]}
                  </h2>
                  <span className="text-xs font-semibold text-slate-400">{calMonth.getFullYear()}</span>
                </div>
                <button
                  onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                  id="cal-next-month"
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all"
                ><ChevronRight size={16} /></button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7">
                {DAYS.map(d => (
                  <div key={d} className="py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {calDays.map((date, i) => {
                  if (!date) return (
                    <div key={`e-${i}`} className="min-h-[100px] bg-slate-50/40 border-b border-r border-slate-100/80" />
                  )
                  const dayPlans = plansForDay(date)
                  const isToday = date.toDateString() === today.toDateString()
                  const isPast = date < today && !isToday
                  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T09:00`

                  return (
                    <div
                      key={date.toISOString()}
                      className={clsx(
                        'min-h-[100px] p-2 border-b border-r border-slate-100/80 group relative transition-all cursor-pointer',
                        isToday ? 'bg-violet-50/60' : isPast ? 'bg-slate-50/20' : 'hover:bg-slate-50/80'
                      )}
                      onClick={() => openAdd(isoDate)}
                    >
                      {/* Date number */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={clsx(
                          'w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-black transition-all',
                          isToday
                            ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md shadow-violet-400/40'
                            : isPast ? 'text-slate-300' : 'text-slate-700'
                        )}>
                          {date.getDate()}
                        </span>
                        {dayPlans.length > 0 && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 rounded-full px-1.5 py-0.5 leading-none">
                            {dayPlans.length}
                          </span>
                        )}
                      </div>

                      {/* Content chips */}
                      <div className="space-y-0.5" onClick={e => e.stopPropagation()}>
                        {dayPlans.slice(0, 3).map(p => {
                          const platform = getPlatform(p.platform)
                          return (
                            <button
                              key={p.id}
                              onClick={() => openEdit(p)}
                              className={clsx(
                                'w-full text-left flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-bold truncate transition-all hover:opacity-80',
                                platform.calChip
                              )}
                            >
                              <platform.icon size={8} className="flex-shrink-0" />
                              <span className="truncate">{p.title}</span>
                            </button>
                          )
                        })}
                        {dayPlans.length > 3 && (
                          <p className="text-[10px] font-semibold text-slate-400 pl-1.5">
                            +{dayPlans.length - 3} more
                          </p>
                        )}
                      </div>

                      {/* Hover add hint */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {dayPlans.length === 0 && (
                          <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
                            <Plus size={14} className="text-violet-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sidebar panel */}
            <div className="space-y-4">

              {/* Quick stats */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_20px_rgba(0,0,0,0.04)] p-4 space-y-3">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Overview</h3>
                {[
                  { label: 'Total Plans', val: stats.total, Icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50' },
                  { label: 'Scheduled', val: stats.scheduled, Icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Published', val: stats.published, Icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Drafts', val: stats.draft, Icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50' },
                ].map(({ label, val, Icon, color, bg }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className={`${bg} rounded-lg p-1.5`}>
                        <Icon size={13} className={color} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{label}</span>
                    </div>
                    <span className={`text-lg font-black ${color}`}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Platforms breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_20px_rgba(0,0,0,0.04)] p-4">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">By Platform</h3>
                <div className="space-y-2">
                  {PLATFORMS.map(p => {
                    const count = plans.filter(pl => pl.platform === p.value).length
                    const pct = plans.length > 0 ? Math.round((count / plans.length) * 100) : 0
                    return (
                      <div key={p.value}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                            <span className="text-[11px] font-semibold text-slate-600">{p.label}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500">{count}</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${p.gradient} rounded-full transition-all duration-700`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_20px_rgba(0,0,0,0.04)] p-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Clock size={11} className="text-amber-500" /> Upcoming
                  </h3>
                  <div className="space-y-1">
                    {upcoming.map(p => {
                      const platform = getPlatform(p.platform)
                      return (
                        <button
                          key={p.id}
                          onClick={() => openEdit(p)}
                          className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 transition-all text-left group"
                        >
                          <div className={`flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br ${platform.gradient} flex items-center justify-center`}>
                            <platform.icon size={12} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate group-hover:text-violet-700 transition-colors">{p.title}</p>
                            {p.scheduledAt && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatDate(p.scheduledAt)} · {formatTime(p.scheduledAt)}
                              </p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ LIST VIEW ════════════════════════════════════════════════════════ */}
        {view === 'list' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center h-52">
                <div className="w-8 h-8 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <CalendarDays size={24} className="opacity-40" />
                </div>
                <p className="font-bold text-slate-600">No content plans found</p>
                <p className="text-sm mt-1">Click "New Content" to schedule your first post</p>
                <button onClick={() => openAdd()} className="mt-5 btn-primary">
                  <Plus size={14} /> Create Plan
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(plan => {
                  const platform = getPlatform(plan.platform)
                  const statusCfg = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft
                  return (
                    <div
                      key={plan.id}
                      className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-[1px] transition-all duration-200 p-5 group"
                    >
                      <div className="flex items-start gap-4">

                        {/* Platform icon */}
                        <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${platform.gradient} flex items-center justify-center shadow-md`}>
                          <platform.icon size={20} className="text-white" />
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          {/* Title + badges */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-bold text-slate-900 text-sm leading-tight">{plan.title}</h3>
                            <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold', statusCfg.pill)}>
                              <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                              {statusCfg.label}
                            </span>
                            <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', platform.pill)}>
                              <platform.icon size={9} />{platform.label}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {plan.contentType}
                            </span>
                          </div>

                          {/* Preview */}
                          <p className="text-[13px] text-slate-500 line-clamp-2 leading-relaxed mb-3">{plan.body}</p>

                          {/* Meta info row */}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-medium">
                            {plan.scheduledAt && (
                              <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200/60">
                                <Clock size={10} />
                                {formatDate(plan.scheduledAt)} · {formatTime(plan.scheduledAt)}
                              </span>
                            )}
                            {plan.targetAudience && (
                              <span className="flex items-center gap-1">
                                <Megaphone size={10} className="text-slate-400" />
                                {plan.targetAudience} leads
                              </span>
                            )}
                            {(plan.tags || []).map(t => (
                              <span key={t} className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-600 rounded-md border border-violet-100 font-semibold">
                                <Tag size={9} /> {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(plan)}
                            id={`edit-plan-${plan.id}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          ><Edit2 size={14} /></button>

                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === plan.id ? null : plan.id)}
                              id={`menu-plan-${plan.id}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                            ><MoreVertical size={14} /></button>

                            {openMenuId === plan.id && (
                              <div className="absolute right-0 top-10 z-30 w-48 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 animate-scale-in">
                                <p className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Change Status</p>
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                  <button
                                    key={k}
                                    onClick={() => updateStatus(plan.id, k)}
                                    className={clsx(
                                      'flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold transition-colors',
                                      plan.status === k ? 'text-violet-700 bg-violet-50' : 'text-slate-600 hover:bg-slate-50'
                                    )}
                                  >
                                    <div className={`w-2 h-2 rounded-full ${v.dot}`} />
                                    {v.label}
                                    {plan.status === k && <span className="ml-auto text-violet-400 text-[10px]">✓</span>}
                                  </button>
                                ))}
                                <div className="border-t border-slate-100 mt-1 pt-1">
                                  <button
                                    onClick={() => { deletePlan(plan.id); setOpenMenuId(null) }}
                                    className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 size={12} /> Delete Plan
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ ADD / EDIT MODAL ═════════════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl animate-scale-in"
            style={{ background: '#fff' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal hero header */}
            <div
              className="relative px-6 pt-6 pb-5"
              style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)' }}
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48Y2lyY2xlIGN4PSIxIiBjeT0iMSIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA2KSIvPjwvZz48L3N2Zz4=')] rounded-t-2xl opacity-60 pointer-events-none" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-violet-300 text-[11px] font-bold uppercase tracking-widest mb-1">
                    {editItem ? 'Edit Plan' : 'New Plan'}
                  </p>
                  <h2 className="text-xl font-black text-white font-['Outfit']">
                    {editItem ? 'Update Content Plan' : 'Create Content Plan'}
                  </h2>
                  <p className="text-violet-200/70 text-xs mt-1">
                    Schedule and plan content across all your marketing channels
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  id="close-modal-btn"
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/10"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Form body */}
            <div className="p-6 space-y-5">

              {/* Title */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Content Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="content-title"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm font-semibold placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 transition-all"
                  placeholder="e.g. Summer Sale Announcement"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Platform selector */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Platform <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      id={`platform-${p.value}`}
                      onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-xs font-bold transition-all',
                        form.platform === p.value
                          ? `bg-gradient-to-r ${p.gradient} text-white border-transparent shadow-lg`
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-white'
                      )}
                    >
                      <p.icon size={14} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type + Status + Audience + Schedule */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Content Type</label>
                  <select
                    id="content-type"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                    value={form.contentType}
                    onChange={e => setForm(f => ({ ...f, contentType: e.target.value }))}
                  >
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Status</label>
                  <select
                    id="content-status"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Target Audience</label>
                  <select
                    id="target-audience"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                    value={form.targetAudience}
                    onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                  >
                    {['All', 'New', 'Contacted', 'Qualified', 'Closed'].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Schedule</label>
                  <input
                    id="scheduled-at"
                    type="datetime-local"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                    value={form.scheduledAt}
                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  />
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">
                    Content Body <span className="text-red-400">*</span>
                  </label>
                  <span className={clsx(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-md',
                    form.body.length > 500 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
                  )}>
                    {form.body.length} chars
                  </span>
                </div>
                <textarea
                  id="content-body"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm leading-relaxed placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 transition-all resize-none"
                  rows={5}
                  placeholder="Write your content here… Use {{name}} to personalize."
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                />
              </div>

              {/* Tags + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tags</label>
                  <input
                    id="content-tags"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm font-medium placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                    placeholder="promo, summer, sale"
                    value={form.tags}
                    onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Internal Notes</label>
                  <input
                    id="content-notes"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-200 text-slate-900 text-sm font-medium placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all"
                    placeholder="Notes for your team…"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
              <p className="text-xs text-slate-400 font-medium">
                {editItem ? '✏️ Editing existing plan' : '✨ New content plan'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  id="cancel-modal-btn"
                  className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 text-slate-600 text-sm font-bold hover:border-slate-300 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  id="save-content-btn"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  {saving
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                    : <><Send size={14} /> {editItem ? 'Save Changes' : 'Create Plan'}</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outside click to close dropdown */}
      {openMenuId && <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />}
    </MainLayout>
  )
}
