import MainLayout from '../layouts/MainLayout'
import PageHeader from '../components/PageHeader'
import { BarChart3, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'https://tpcrm.onrender.com'

export default function Analytics() {
  const { currentUser } = useAuth()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchAnalytics(isRefresh = false) {
    if (!currentUser) return
    if (isRefresh) setRefreshing(true)
    try {
      const token = await currentUser!.getIdToken()
      const res = await fetch(`${API}/analytics/`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch analytics')
      const json = await res.json()
      setData(json)
      if (isRefresh) toast.success('Analytics refreshed')
    } catch (e: any) {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [currentUser])

  if (loading) return <MainLayout><div className="flex justify-center p-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div></MainLayout>

  const kpis = data?.kpis || []
  const monthlyData = data?.monthlyData || []
  const sourceData = data?.sourceData || []
  const serviceData = data?.serviceData || []

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          title="Analytics"
          subtitle="Performance insights across leads, messages & campaigns"
          icon={<BarChart3 size={20} />}
          badge="Live Data"
          actions={
            <button 
              onClick={() => fetchAnalytics(true)} 
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          }
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
              {serviceData.map(({ name, value }: any, idx: number) => {
                const total = serviceData.reduce((a: any, b: any) => a + b.value, 0)
                const pct = total === 0 ? 0 : Math.round((value / total) * 100)
                const colors = ['#100F88', '#FFC263', '#10b981', '#7c3aed']
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-semibold" style={{ color: '#0d0c50' }}>{name}</span>
                      <span className="font-bold" style={{ color: colors[idx % colors.length] }}>{pct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#e4e4f0' }}>
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%`, background: colors[idx % colors.length] }}
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
