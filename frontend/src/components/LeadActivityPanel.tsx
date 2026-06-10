import { useState, useEffect, useRef } from 'react'
import {
  X, Plus, CheckCircle2, Circle, Trash2, CalendarCheck,
  Phone, MessageCircle, Mail, FileText, Video, ChevronDown,
  ExternalLink, Clock, MapPin, Calendar, AlertCircle, Loader2,
} from 'lucide-react'
import clsx from 'clsx'
import {
  collection, addDoc, onSnapshot, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { LeadActivity, ActivityType, Lead } from '../types'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'


// ── Activity meta ──────────────────────────────────────────────────────────
const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: 'note',     label: 'Note',      icon: FileText,      color: 'text-slate-600',   bg: 'bg-slate-100' },
  { value: 'call',     label: 'Call',       icon: Phone,         color: 'text-blue-600',    bg: 'bg-blue-100' },
  { value: 'whatsapp', label: 'WhatsApp',   icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  { value: 'email',    label: 'Email',      icon: Mail,          color: 'text-violet-600',  bg: 'bg-violet-100' },
  { value: 'meeting',  label: 'Meeting',    icon: Video,         color: 'text-amber-600',   bg: 'bg-amber-100' },
  { value: 'response', label: 'Response',   icon: CheckCircle2,  color: 'text-pink-600',    bg: 'bg-pink-100' },
]

function getActivityMeta(type: ActivityType) {
  return ACTIVITY_TYPES.find(t => t.value === type) ?? ACTIVITY_TYPES[0]
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ── Single Activity Card ───────────────────────────────────────────────────
function ActivityCard({
  activity,
  onToggleDone,
  onDelete,
}: {
  activity: LeadActivity
  onToggleDone: (a: LeadActivity) => void
  onDelete: (a: LeadActivity) => void
}) {
  const meta = getActivityMeta(activity.type)
  const Icon = meta.icon

  return (
    <div className={clsx(
      'group rounded-xl border p-4 transition-all duration-200',
      activity.isDone
        ? 'border-slate-200 bg-slate-50 opacity-60'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
    )}>
      <div className="flex items-start gap-3.5">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm', meta.bg)}>
          <Icon size={16} className={meta.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className={clsx(
              'text-sm font-black leading-tight flex-1 break-words pt-1',
              activity.isDone ? 'line-through text-slate-500' : 'text-black'
            )}>
              {activity.title}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => onToggleDone(activity)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all duration-150"
                title={activity.isDone ? 'Mark incomplete' : 'Mark done'}
              >
                {activity.isDone
                  ? <CheckCircle2 size={14} />
                  : <Circle size={14} />
                }
              </button>
              <button
                onClick={() => onDelete(activity)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-150"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {activity.description && (
            <p className="text-[13px] text-black font-semibold opacity-80 mt-1.5 leading-relaxed">{activity.description}</p>
          )}

          {activity.scheduledAt && (
            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-black font-bold">
                <Clock size={13} className="text-amber-500" />
                {formatDateTime(activity.scheduledAt)}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-3">
            <span className={clsx('text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md border border-white/50', meta.bg, meta.color)}>
              {meta.label}
            </span>
            <span className="text-[10px] font-bold text-black opacity-50">{timeAgo(activity.createdAt)}</span>
            {activity.isDone && (
              <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md">
                <CheckCircle2 size={10} /> Done
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────
export default function LeadActivityPanel({
  lead,
  onClose,
}: {
  lead: Lead
  onClose: () => void
}) {
  const { currentUser } = useAuth()
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)

  // Form
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formScheduledAt, setFormScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Firestore real-time listener for activities ──────────────────────────
  useEffect(() => {
    const ref = collection(db, 'leads', lead.id, 'activities')
    const q = query(ref, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      snap => {
        setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeadActivity)))
        setLoadingActivities(false)
      },
      err => {
        console.error('Activities listener error:', err)
        setLoadingActivities(false)
      }
    )
    return unsub
  }, [lead.id])

  // ── Submit activity (Firestore) ──────────────────────────────────────────
  async function handleSubmit() {
    if (!formTitle.trim()) return toast.error('Title is required')

    setSubmitting(true)
    try {
      const now = new Date().toISOString()
      const uid = currentUser?.uid || localStorage.getItem('user')
        ? JSON.parse(localStorage.getItem('user') || '{}').uid
        : 'admin'

      let calendarEventLink: string | null = null

      // ── If a time is scheduled: Build Google Calendar deep link ──
      if (formScheduledAt) {
        const startDate = new Date(formScheduledAt)
        const endDate = new Date(startDate.getTime() + 30 * 60000) // Default 30 min

        const formatGoogleDate = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '')
        
        const params = new URLSearchParams({
          action: 'TEMPLATE',
          text: formTitle,
          details: formDesc + `\n\nLead: ${lead.fullName}\nPhone: ${lead.phone}${lead.email ? `\nEmail: ${lead.email}` : ''}`,
          dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
        })

        calendarEventLink = `https://calendar.google.com/calendar/r/eventedit?${params.toString()}`
        window.open(calendarEventLink, '_blank')
        toast.success('Opening Google Calendar!')
      }

      const activityData = {
        leadId: lead.id,
        type: 'note',
        title: formTitle,
        description: formDesc,
        scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
        isDone: false,
        createdAt: now,
        createdBy: uid,
      }

      await addDoc(collection(db, 'leads', lead.id, 'activities'), activityData)

      // Update lead lastContactedAt and updatedAt
      await updateDoc(doc(db, 'leads', lead.id), {
        lastContactedAt: now,
        updatedAt: now,
      })

      toast.success('Saved successfully ✅')
      setFormTitle('')
      setFormDesc('')
      setFormScheduledAt('')
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Failed to log activity')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Toggle done — update Firestore + Calendar event title ─────────────────
  async function handleToggleDone(activity: LeadActivity) {
    const newDone = !activity.isDone
    try {
      await updateDoc(doc(db, 'leads', lead.id, 'activities', activity.id), { isDone: newDone })
      toast.success(newDone ? '✅ Marked as done' : 'Marked as incomplete')
    } catch {
      toast.error('Failed to update activity')
    }
  }

  // ── Delete — Firestore + Calendar event ──────────────────────────────────
  async function handleDelete(activity: LeadActivity) {
    if (!confirm('Delete this activity?')) return
    try {
      await deleteDoc(doc(db, 'leads', lead.id, 'activities', activity.id))
      toast.success('Activity deleted')
    } catch {
      toast.error('Failed to delete activity')
    }
  }

  const doneCnt  = activities.filter(a => a.isDone).length
  const totalCnt = activities.length

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[480px] z-50 flex flex-col bg-white shadow-2xl border-l border-slate-200 animate-slide-right">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{lead.fullName}</h2>
              <p className="text-xs text-slate-500">{lead.phone} · {lead.leadSource}</p>
              {totalCnt > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{doneCnt}/{totalCnt} activities done</p>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0 ml-2">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── New Activity Form ────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-200 flex-shrink-0 space-y-3">
          {/* Title */}
          <div>
            <label className="label text-xs">Title</label>
            <input
              className="input-field text-sm"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="What happened? e.g. Follow-up meeting"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label text-xs">Description / Notes</label>
            <textarea
              className="input-field text-sm resize-none"
              rows={2}
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Lead response, next steps, details..."
            />
          </div>

          {/* Optional Scheduling fields */}
          <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar size={12} /> Schedule / Add to Calendar (Optional)
            </p>
            <div>
              <label className="label text-xs">Date & Time</label>
              <input
                type="datetime-local"
                className="input-field text-sm"
                value={formScheduledAt}
                onChange={e => setFormScheduledAt(e.target.value)}
              />
            </div>
            {formScheduledAt && (
              <div className="flex items-start gap-2 text-[11px] text-emerald-600 font-medium">
                <CalendarCheck size={11} className="mt-0.5 flex-shrink-0" />
                <span>Saving this activity will open Google Calendar to instantly add it to your schedule.</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Plus size={14} /> Save Note & Schedule</>}
          </button>
        </div>

        {/* ── Activity Timeline ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 min-h-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Activity History</p>
            {totalCnt > 0 && <span className="text-xs text-slate-400">{totalCnt} total</span>}
          </div>

          {loadingActivities ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <FileText size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No activities yet</p>
              <p className="text-xs text-slate-400 mt-1">Log your first interaction above</p>
            </div>
          ) : (
            <>
              {/* Pending */}
              {activities.filter(a => !a.isDone).length > 0 && (
                <div className="space-y-2">
                  {activities.filter(a => !a.isDone).map(a => (
                    <ActivityCard key={a.id} activity={a} onToggleDone={handleToggleDone} onDelete={handleDelete} />
                  ))}
                </div>
              )}

              {/* Completed (collapsible) */}
              {activities.filter(a => a.isDone).length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600 list-none select-none py-1">
                    <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                    {activities.filter(a => a.isDone).length} completed
                  </summary>
                  <div className="mt-2 space-y-2">
                    {activities.filter(a => a.isDone).map(a => (
                      <ActivityCard key={a.id} activity={a} onToggleDone={handleToggleDone} onDelete={handleDelete} />
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
