import MainLayout from '../layouts/MainLayout'
import PageHeader from '../components/PageHeader'
import { BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react'
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
  { name: 'Facebook Ads', value: 42, fill: '#100F88' },
  { name: 'Instagram Ads', value: 28, fill: '#FFC263' },
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
  { label: 'Total Revenue', value: '₹4.8L', change: '+23%', up: true, color: '#100F88', strip: '#100F88' },
  { label: 'Avg Deal Size', value: '₹18,500', change: '+8%', up: true, color: '#059669', strip: '#10b981' },
  { label: 'Response Rate', value: '68%', change: '+12%', up: true, color: '#7c3aed', strip: '#7c3aed' },
  { label: 'Churn Rate', value: '4.2%', change: '-2%', up: false, color: '#ef4444', strip: '#ef4444' },
]

export default function Analytics() {
  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          title="Analytics"
          subtitle="Performance insights across leads, messages & campaigns"
          icon={<BarChart3 size={20} />}
          badge="Live Data"
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map(({ label, value, change, up, color, strip }) => (
            <div
              key={label}
              className="card p-5 cursor-default animate-slide-up"
              style={{ borderLeft: `4px solid ${strip}` }}
            >
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#9896cc' }}>{label}</p>
              <p className="text-2xl font-black tabular-nums" style={{ color, letterSpacing: '-0.04em' }}>{value}</p>
              <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {change} vs last month
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Monthly Leads Trend */}
          <div className="card p-6">
            <h2 className="text-base font-bold mb-0.5" style={{ color: '#0d0c50' }}>Monthly Lead Growth</h2>
            <p className="text-xs font-medium mb-5" style={{ color: '#9896cc' }}>Leads vs. conversions by month</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4f0" />
                <XAxis dataKey="month" tick={{ fill: '#9896cc', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9896cc', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #d8d8ee', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 20px rgba(16,15,136,0.10)' }} />
                <Bar dataKey="leads" fill="#100F88" radius={[5, 5, 0, 0]} name="Leads" />
                <Bar dataKey="conversions" fill="#FFC263" radius={[5, 5, 0, 0]} name="Conversions" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Message Activity */}
          <div className="card p-6">
            <h2 className="text-base font-bold mb-0.5" style={{ color: '#0d0c50' }}>Message Activity</h2>
            <p className="text-xs font-medium mb-5" style={{ color: '#9896cc' }}>WhatsApp messages sent per month</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4f0" />
                <XAxis dataKey="month" tick={{ fill: '#9896cc', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9896cc', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #d8d8ee', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 20px rgba(16,15,136,0.10)' }} />
                <Line type="monotone" dataKey="messages" stroke="#100F88" strokeWidth={2.5} dot={{ fill: '#100F88', r: 4 }} name="Messages" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-5">
          {/* Lead Sources Pie */}
          <div className="card p-6">
            <h2 className="text-base font-bold mb-0.5" style={{ color: '#0d0c50' }}>Lead Sources</h2>
            <p className="text-xs font-medium mb-5" style={{ color: '#9896cc' }}>Where leads are coming from</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {sourceData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #d8d8ee', borderRadius: 12, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#5a5898' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Services */}
          <div className="card p-6">
            <h2 className="text-base font-bold mb-0.5" style={{ color: '#0d0c50' }}>Top Services Interested</h2>
            <p className="text-xs font-medium mb-5" style={{ color: '#9896cc' }}>Most requested services from leads</p>
            <div className="space-y-4">
              {serviceData.map(({ name, value }, idx) => {
                const total = serviceData.reduce((a, b) => a + b.value, 0)
                const pct = Math.round((value / total) * 100)
                const colors = ['#100F88', '#FFC263', '#10b981', '#7c3aed']
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold" style={{ color: '#0d0c50' }}>{name}</span>
                      <span className="font-bold" style={{ color: colors[idx] }}>{pct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#e4e4f0' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%`, background: colors[idx] }}
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
