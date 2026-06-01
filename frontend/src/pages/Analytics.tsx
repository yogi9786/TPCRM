import MainLayout from '../layouts/MainLayout'
import { BarChart3, TrendingUp, MessageCircle, Users, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const monthlyData = [
  { month: 'Jan', leads: 45, messages: 120, conversions: 8 },
  { month: 'Feb', leads: 62, messages: 180, conversions: 14 },
  { month: 'Mar', leads: 78, messages: 210, conversions: 18 },
  { month: 'Apr', leads: 55, messages: 165, conversions: 12 },
  { month: 'May', leads: 91, messages: 280, conversions: 23 },
  { month: 'Jun', leads: 108, messages: 340, conversions: 31 },
]

const sourceData = [
  { name: 'Facebook Ads', value: 42, fill: '#0ea5e9' },
  { name: 'Instagram Ads', value: 28, fill: '#ec4899' },
  { name: 'Website', value: 18, fill: '#10b981' },
  { name: 'WhatsApp', value: 8, fill: '#22c55e' },
  { name: 'Referral', value: 4, fill: '#f59e0b' },
]

const serviceData = [
  { name: 'WhatsApp Marketing', value: 38 },
  { name: 'CRM Setup', value: 25 },
  { name: 'Meta Ads', value: 22 },
  { name: 'Website Dev', value: 15 },
]

const kpis = [
  { label: 'Total Revenue', value: '₹4.8L', change: '+23%', up: true, color: 'text-emerald-400', border: 'border-emerald-500/20' },
  { label: 'Avg Deal Size', value: '₹18,500', change: '+8%', up: true, color: 'text-sky-400', border: 'border-sky-500/20' },
  { label: 'Response Rate', value: '68%', change: '+12%', up: true, color: 'text-violet-400', border: 'border-violet-500/20' },
  { label: 'Churn Rate', value: '4.2%', change: '-2%', up: false, color: 'text-red-400', border: 'border-red-500/20' },
]

export default function Analytics() {
  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BarChart3 className="text-violet-400" size={24} /> Analytics
          </h1>
          <p className="page-subtitle">Performance insights across leads, messages & campaigns</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(({ label, value, change, up, color, border }) => (
            <div key={label} className={`glass-card p-5 border ${border}`}>
              <p className="text-xs text-slate-500 mb-2">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <div className={clsx('flex items-center gap-1 mt-2 text-xs font-medium', up ? 'text-emerald-400' : 'text-red-400')}>
                {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {change} vs last month
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Monthly Leads Trend */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-1">Monthly Lead Growth</h2>
            <p className="text-xs text-slate-500 mb-5">Leads vs. messages vs. conversions</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="leads" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Leads" />
                <Bar dataKey="conversions" fill="#10b981" radius={[4, 4, 0, 0]} name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Message Activity */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-1">Message Activity</h2>
            <p className="text-xs text-slate-500 mb-5">WhatsApp messages sent per month</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="messages" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 4 }} name="Messages" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-5">
          {/* Lead Sources Pie */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-1">Lead Sources</h2>
            <p className="text-xs text-slate-500 mb-5">Where leads are coming from</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {sourceData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Services */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-semibold text-white mb-1">Top Services Interested</h2>
            <p className="text-xs text-slate-500 mb-5">Most requested services from leads</p>
            <div className="space-y-4">
              {serviceData.map(({ name, value }) => {
                const pct = Math.round((value / serviceData.reduce((a, b) => a + b.value, 0)) * 100)
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-300">{name}</span>
                      <span className="text-slate-400 font-medium">{pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

// Missing clsx import helper
function clsx(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
