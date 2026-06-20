import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  Users, UserPlus, MessageCircle, CheckCircle2,
  ArrowUpRight, BarChart3, Zap, RefreshCw,
  CalendarClock, Sparkles, Activity, TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../layouts/MainLayout'
import PageHeader from '../components/PageHeader'
import { Lead } from '../types'
import clsx from 'clsx'

/* ─────────────────────────────────────────────────────────────
   Animated counter hook
───────────────────────────────────────────────────────────── */
function useAnimatedCounter(target: number, duration = 900) {
  const [count, setCount] = useState(0)
  const animRef = useRef<number>()
  useEffect(() => {
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCount(Math.round(from + (target - from) * eased))
      if (progress < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [target, duration])
  return count
}

/* ─────────────────────────────────────────────────────────────
   Animated KPI card
───────────────────────────────────────────────────────────── */
function KPICard({ title, value, rawValue, sub, icon: Icon, iconBg, iconColor, accentColor, suffix = '', delay = 0 }: {
  title: string; value?: string | number; rawValue: number; sub: string
  icon: React.ElementType; iconBg: string; iconColor: string; accentColor: string
  suffix?: string; delay?: number
}) {
  const counted = useAnimatedCounter(rawValue, 800 + delay * 50)
  const displayed = value !== undefined ? value : `${counted}${suffix}`

  return (
    <div
      className="card p-5 cursor-default group overflow-hidden relative"
      style={{
        animation: `slideUp 0.5s cubic-bezier(0.16,1,0.3,1) ${delay * 80}ms both`,
        borderLeft: `4px solid ${accentColor}`,
        transition: 'all 0.2s ease-out',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(16,15,136,0.14)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
    >
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110" style={{ background: iconBg }}>
          <Icon size={18} strokeWidth={2} style={{ color: iconColor }} />
        </div>
        <p className="text-2xl font-black tabular-nums" style={{ letterSpacing: '-0.04em', color: '#0d0c50' }}>{displayed}</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: '#0d0c50' }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: '#9896cc' }}>{sub}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Progress bar with animation
───────────────────────────────────────────────────────────── */
function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => { const t = setTimeout(() => setWidth(pct), 200); return () => clearTimeout(t) }, [pct])
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${width}%` }} />
    </div>
  )
}

const leadTrendData = [
  { day: 'Mon', leads: 12, contacted: 8 },
  { day: 'Tue', leads: 19, contacted: 14 },
  { day: 'Wed', leads: 15, contacted: 11 },
  { day: 'Thu', leads: 28, contacted: 20 },
  { day: 'Fri', leads: 22, contacted: 18 },
  { day: 'Sat', leads: 34, contacted: 25 },
  { day: 'Sun', leads: 18, contacted: 13 },
]
const PIE_COLORS = ['#100F88', '#FFC263', '#10b981', '#7c3aed', '#ef4444']

/* ─────────────────────────────────────────────────────────────
   Dashboard
───────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { currentUser } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [contentPlans, setContentPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [heroVisible, setHeroVisible] = useState(false)

  useEffect(() => { const t = setTimeout(() => setHeroVisible(true), 50); return () => clearTimeout(t) }, [])

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    setTimeout(() => { setIsRefreshing(false); toast.success('Refreshed!') }, 700)
  }, [])

  useEffect(() => {
    if (!currentUser) return
    const uid = currentUser.uid
    const subs = [
      onSnapshot(query(collection(db, 'leads'), where('userId', '==', uid)), snap => {
        setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)))
        setLoading(false)
      }),
      onSnapshot(query(collection(db, 'content_plans'), where('userId', '==', uid)), snap =>
        setContentPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      ),
    ]
    return () => subs.forEach(u => u())
  }, [currentUser])

  const stats = useMemo(() => ({
    total: leads.length,
    newLeads: leads.filter(l => l.status === 'New').length,
    contacted: leads.filter(l => l.status === 'Contacted').length,
    qualified: leads.filter(l => l.status === 'Qualified').length,
    closed: leads.filter(l => l.status === 'Closed').length,
  }), [leads])

  const conversion = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0

  const sourceBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    leads.forEach(l => { map[l.leadSource] = (map[l.leadSource] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [leads])

  const recentLeads = useMemo(() =>
    [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
    , [leads])

  const upcomingContent = useMemo(() =>
    contentPlans
      .filter(p => p.scheduledAt && new Date(p.scheduledAt) >= new Date())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 4)
    , [contentPlans])

  const statusBadge = (s: string) => ({
    New: 'badge-new', Contacted: 'badge-contacted',
    Qualified: 'badge-qualified', Closed: 'badge-closed', Lost: 'badge-lost',
  }[s] || 'badge-new')

  const kpis = [
    { title: 'Total Leads',  rawValue: stats.total,     sub: 'All time',         icon: Users,        iconBg: 'rgba(16,15,136,0.08)',  iconColor: '#100F88',   accentColor: '#100F88' },
    { title: 'New Leads',    rawValue: stats.newLeads,  sub: 'Awaiting contact', icon: UserPlus,     iconBg: 'rgba(255,194,99,0.15)', iconColor: '#f0a832',   accentColor: '#FFC263' },
    { title: 'Contacted',    rawValue: stats.contacted, sub: 'In progress',      icon: MessageCircle,iconBg: 'rgba(16,185,129,0.10)', iconColor: '#059669',   accentColor: '#10b981' },
    { title: 'Qualified',    rawValue: stats.qualified, sub: 'Ready to close',   icon: TrendingUp,   iconBg: 'rgba(124,58,237,0.10)', iconColor: '#7c3aed',   accentColor: '#7c3aed' },
    { title: 'Closed',       rawValue: stats.closed,    sub: 'Deals won',        icon: CheckCircle2, iconBg: 'rgba(16,185,129,0.10)', iconColor: '#059669',   accentColor: '#059669' },
    { title: 'Conversion',   rawValue: conversion,      sub: `${stats.closed} closed`, icon: BarChart3, iconBg: 'rgba(16,15,136,0.08)', iconColor: '#100F88', accentColor: '#FFC263', suffix: '%' },
  ]

  /* Lead stage breakdown for the mini pipeline */
  const stages = [
    { label: 'New',       count: stats.newLeads,  color: '#100F88',  pct: stats.total ? (stats.newLeads  / stats.total) * 100 : 0 },
    { label: 'Contacted', count: stats.contacted, color: '#FFC263',  pct: stats.total ? (stats.contacted / stats.total) * 100 : 0 },
    { label: 'Qualified', count: stats.qualified, color: '#7c3aed',  pct: stats.total ? (stats.qualified / stats.total) * 100 : 0 },
    { label: 'Closed',    count: stats.closed,    color: '#10b981',  pct: stats.total ? (stats.closed    / stats.total) * 100 : 0 },
  ]

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* ══ PAGE HEADER ════════════════════════════════════════ */}
        <PageHeader
          title={`Welcome back, ${currentUser?.displayName || 'Admin'} 👋`}
          subtitle={stats.newLeads > 0 ? `${stats.newLeads} new leads waiting — let's convert them!` : 'Everything looks great. Keep up the momentum!'}
          icon={<Zap size={20} />}
          badge="TekhPortal CRM"
          actions={
            <button onClick={handleRefresh} className="btn-accent">
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          }
        />

        {/* ══ KPI GRID ════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((kpi, i) => (
            <KPICard key={kpi.title} {...kpi} delay={i} />
          ))}
        </div>

        {/* ══ PIPELINE BAR ════════════════════════════════════════ */}
        <div className="card p-5" style={{ animation: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Lead Pipeline</h2>
            <span className="text-xs font-semibold text-slate-400">{stats.total} total</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stages.map(s => (
              <div key={s.label} className="group cursor-default">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-bold" style={{ color: '#5a5898' }}>{s.label}</span>
                  <span className="text-sm font-black tabular-nums" style={{ color: '#0d0c50' }}>{s.count}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#e4e4f0' }}>
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
                <p className="text-[10px] mt-1 font-semibold" style={{ color: '#9896cc' }}>{Math.round(s.pct)}%</p>
              </div>
          ))}
          </div>
        </div>

        {/* ══ CHARTS ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5" style={{ animation: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s both' }}>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title">Lead Activity</h2>
                <p className="text-xs text-slate-400 mt-0.5">New leads vs. contacted this week</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-500 rounded-full" />New</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-violet-500 rounded-full" />Contacted</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={leadTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4f0" />
                <XAxis dataKey="day" tick={{ fill: '#9896cc', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9896cc', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #d8d8ee', borderRadius: 12, fontSize: 13, boxShadow: '0 4px 20px rgba(16,15,136,0.10)' }}
                  labelStyle={{ color: '#0d0c50', fontWeight: 700 }}
                />
                <Line type="monotone" dataKey="leads" stroke="#100F88" strokeWidth={2.5}
                  dot={{ fill: '#100F88', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#0c0b6e' }} name="New Leads" />
                <Line type="monotone" dataKey="contacted" stroke="#FFC263" strokeWidth={2.5}
                  dot={{ fill: '#FFC263', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#f0a832' }} name="Contacted" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <div className="mb-6">
              <h2 className="section-title">Lead Sources</h2>
              <p className="text-xs text-slate-400 mt-0.5">Breakdown by acquisition channel</p>
            </div>
            {sourceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sourceBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={3} dataKey="value">
                    {sourceBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-slate-400">
                <BarChart3 size={28} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">Add leads to see sources</p>
              </div>
            )}
          </div>
        </div>

        {/* ══ BOTTOM ROW ══════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5" style={{ animation: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}>

          {/* Recent Leads */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="section-title">Recent Leads</h2>
              <a href="/crm" className="inline-flex items-center gap-1 text-xs font-bold hover:underline transition-colors group" style={{ color: '#100F88' }}>
                View all <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                <Users size={28} className="mb-2 opacity-30" />
                <p className="text-sm font-medium">No leads yet</p>
                <a href="/crm" className="text-xs text-blue-500 hover:text-blue-700 mt-1 font-semibold">Add your first lead →</a>
              </div>
            ) : (
              <div>
                {recentLeads.map((lead, i) => (
                  <div
                    key={lead.id}
                    className={clsx(
                      'flex items-center justify-between px-6 py-3.5 animate-list-item',
                      'hover:bg-slate-50 transition-all duration-150 cursor-pointer group',
                      i !== recentLeads.length - 1 && 'border-b border-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 group-hover:scale-110 transition-transform duration-200" style={{ background: 'linear-gradient(135deg, #100F88, #1a19c0)' }}>
                        {lead.fullName?.charAt(0) ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">{lead.fullName}</p>
                        <p className="text-xs text-slate-400 truncate">{lead.phone} · {lead.leadSource}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={statusBadge(lead.status)}>{lead.status}</span>
                      <ArrowUpRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Content */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="section-title flex items-center gap-2">
                <CalendarClock size={16} className="text-violet-500" />
                Upcoming Content
              </h2>
              <a href="/content-planner" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors group">
                Planner <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>
            {upcomingContent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                <CalendarClock size={28} className="mb-2 opacity-30 text-violet-400" />
                <p className="text-sm font-medium">No content scheduled</p>
                <a href="/content-planner" className="text-xs text-blue-500 hover:text-blue-700 mt-1 font-semibold">Schedule content →</a>
              </div>
            ) : (
              <div>
                {upcomingContent.map((plan, i) => {
                  const date = new Date(plan.scheduledAt)
                  const isToday = date.toDateString() === new Date().toDateString()
                  return (
                    <div
                      key={plan.id}
                      className={clsx(
                        'flex items-center gap-3.5 px-6 py-3.5 animate-list-item',
                        'hover:bg-slate-50 transition-all duration-150 cursor-pointer group',
                        i !== upcomingContent.length - 1 && 'border-b border-slate-100'
                      )}
                    >
                      <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                        <Sparkles size={14} className="text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-violet-700 transition-colors">{plan.title}</p>
                        <p className="text-xs text-slate-400">
                          {isToday
                            ? <span className="text-violet-600 font-bold">Today</span>
                            : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                          } · {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        {plan.platform}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </MainLayout>
  )
}
