import { useEffect, useState } from 'react'
import {
  Users, UserPlus, MessageCircle, CheckCircle2,
  TrendingUp, Megaphone, ArrowUpRight, Activity,
  CalendarClock, BarChart3, Zap, Bell,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { Lead } from '../types'

const leadTrendData = [
  { day: 'Mon', leads: 12, contacted: 8 },
  { day: 'Tue', leads: 19, contacted: 14 },
  { day: 'Wed', leads: 15, contacted: 11 },
  { day: 'Thu', leads: 28, contacted: 20 },
  { day: 'Fri', leads: 22, contacted: 18 },
  { day: 'Sat', leads: 34, contacted: 25 },
  { day: 'Sun', leads: 18, contacted: 13 },
]

const sourceColors = ['#0ea5e9', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6']

const reminders = [
  { name: 'Call Rahul Sharma', time: 'Today · 3:00 PM', type: 'urgent' },
  { name: 'Follow-up Sneha Patil', time: 'Tomorrow · 10:30 AM', type: 'normal' },
  { name: 'Demo with Amit Tech', time: 'Thu · 2:00 PM', type: 'normal' },
]

export default function Dashboard() {
  const { currentUser } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'leads'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)))
      setLoading(false)
    })
    return unsub
  }, [currentUser])

  const stats = {
    total: leads.length,
    newLeads: leads.filter(l => l.status === 'New').length,
    contacted: leads.filter(l => l.status === 'Contacted').length,
    qualified: leads.filter(l => l.status === 'Qualified').length,
    closed: leads.filter(l => l.status === 'Closed').length,
    lost: leads.filter(l => l.status === 'Lost').length,
  }
  const conversion = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0

  const sourceBreakdown = (() => {
    const map: Record<string, number> = {}
    leads.forEach(l => { map[l.leadSource] = (map[l.leadSource] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  })()

  const recentLeads = [...leads].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5)

  const kpis = [
    { title: 'Total Leads', value: stats.total, sub: '+12% this month', icon: Users, gradient: 'from-sky-500/20 to-sky-600/10', iconColor: 'text-blue-700', border: 'border-sky-500/20' },
    { title: 'New Leads', value: stats.newLeads, sub: 'Awaiting contact', icon: UserPlus, gradient: 'from-violet-500/20 to-violet-600/10', iconColor: 'text-violet-400', border: 'border-violet-500/20' },
    { title: 'Contacted', value: stats.contacted, sub: 'In progress', icon: MessageCircle, gradient: 'from-amber-500/20 to-amber-600/10', iconColor: 'text-amber-400', border: 'border-amber-500/20' },
    { title: 'Conversion', value: `${conversion}%`, sub: `${stats.closed} deals closed`, icon: CheckCircle2, gradient: 'from-emerald-500/20 to-emerald-600/10', iconColor: 'text-emerald-400', border: 'border-emerald-500/20' },
    { title: 'Qualified', value: stats.qualified, sub: 'Ready to close', icon: TrendingUp, gradient: 'from-pink-500/20 to-pink-600/10', iconColor: 'text-pink-400', border: 'border-pink-500/20' },
    { title: 'Campaigns', value: 3, sub: 'Active broadcasts', icon: Megaphone, gradient: 'from-orange-500/20 to-orange-600/10', iconColor: 'text-orange-400', border: 'border-orange-500/20' },
  ]

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      New: 'badge-new',
      Contacted: 'badge-contacted',
      Qualified: 'badge-qualified',
      Closed: 'badge-closed',
      Lost: 'badge-lost',
    }
    return map[status] || 'badge-new'
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Hero */}
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-blue-700 font-semibold mb-2 flex items-center gap-2">
                <Zap size={12} /> TekhPortal Automation Suite
              </p>
              <h1 className="text-3xl font-bold font-display text-slate-900">
                Welcome back, <span className="text-gradient">Admin</span> 👋
              </h1>
              <p className="text-slate-500 text-sm mt-2 max-w-lg">
                Manage leads, automate conversations, and monitor campaigns from your centralized CRM.
              </p>
            </div>
            <div className="glass-card p-5 min-w-[220px] space-y-3 border-slate-200">
              <p className="text-xs text-slate-500 flex items-center gap-2"><Activity size={12} /> Live Overview</p>
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Active Campaigns</span>
                  <span className="font-semibold text-slate-900">3</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Conversion Rate</span>
                  <span className="font-semibold text-emerald-400">{conversion}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Leads</span>
                  <span className="font-semibold text-slate-900">{loading ? '—' : stats.total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map(({ title, value, sub, icon: Icon, gradient, iconColor, border }, i) => {
            const delays = ['delay-75', 'delay-100', 'delay-150', 'delay-200', 'delay-300', 'delay-300'];
            return (
              <div key={title} className={`glass-card p-5 border ${border} hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg transition-all duration-300 animate-slide-up ${delays[i % delays.length]}`}>
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} shadow-sm border border-white/50 flex items-center justify-center mb-4`}>
                  <Icon size={20} strokeWidth={2.5} className={iconColor} />
                </div>
                <p className="text-3xl font-extrabold text-slate-900 font-display tracking-tight">{loading ? '—' : value}</p>
                <p className="text-sm font-semibold text-slate-600 mt-1 truncate">{title}</p>
                <p className="text-xs font-medium text-slate-400 truncate mt-0.5">{sub}</p>
              </div>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 animate-slide-up delay-200">
          {/* Line chart */}
          <div className="glass-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Lead Activity</h2>
                <p className="text-xs text-slate-500">New leads vs. contacted this week</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-sky-400 inline-block rounded" />New</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-violet-400 inline-block rounded" />Contacted</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={leadTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 13 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line type="monotone" dataKey="leads" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 3 }} name="New Leads" />
                <Line type="monotone" dataKey="contacted" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} name="Contacted" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div className="glass-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">Lead Sources</h2>
              <p className="text-xs text-slate-500">Breakdown by acquisition channel</p>
            </div>
            {sourceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sourceBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {sourceBreakdown.map((_, i) => <Cell key={i} fill={sourceColors[i % sourceColors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 13 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-slate-600">
                <BarChart3 size={32} className="mb-2 opacity-40" />
                <p className="text-sm">Add leads to see sources</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-6 animate-slide-up delay-300">
          {/* Recent Leads */}
          <div className="glass-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-900">Recent Leads</h2>
              <a href="/crm" className="text-xs text-blue-700 hover:text-sky-300 flex items-center gap-1 transition-colors">
                View all <ArrowUpRight size={12} />
              </a>
            </div>
            {recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                <Users size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No leads yet — add some from CRM</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentLeads.map(lead => (
                  <div key={lead.id} className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500/20 to-violet-500/20 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                        {lead.fullName?.charAt(0) ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{lead.fullName}</p>
                        <p className="text-xs text-slate-500 truncate">{lead.phone} · {lead.leadSource}</p>
                      </div>
                    </div>
                    <span className={statusBadge(lead.status)}>{lead.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminders */}
          <div className="glass-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-5">
              <Bell size={16} className="text-amber-400" />
              <h2 className="text-base font-semibold text-slate-900">Upcoming Reminders</h2>
            </div>
            <div className="space-y-3">
              {reminders.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${r.type === 'urgent'
                    ? 'border-red-500/20 bg-red-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarClock size={14} className={r.type === 'urgent' ? 'text-red-400' : 'text-amber-400'} />
                    <p className="text-sm font-medium text-slate-900">{r.name}</p>
                  </div>
                  <p className="text-xs text-slate-500 ml-5">{r.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
