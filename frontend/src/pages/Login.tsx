import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowRight, MessageCircle, Share2, BarChart3, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const features = [
  { icon: Users,         label: 'Lead Management',      sub: 'Centralise and track every lead', color: 'text-blue-400',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { icon: MessageCircle, label: 'WhatsApp Automation',  sub: 'Send campaigns at scale',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { icon: Share2,        label: 'Meta Ads Integration', sub: 'Capture leads from Facebook & IG', color: 'text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { icon: BarChart3,     label: 'Real-time Analytics',  sub: 'Insights that drive decisions',   color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
]

export default function Login() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]         = useState(false)
  const { login }                     = useAuth()
  const navigate                      = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) return toast.error('Please enter your credentials')
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome to TekhPortal!')
      navigate('/')
    } catch (err: any) {
      const msg =
        err?.code === 'auth/invalid-credential' || err?.message === 'Invalid email or password'
          ? 'Invalid email or password'
          : err?.code === 'auth/user-not-found'
          ? 'No account found with this email'
          : err?.message || 'Sign in failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090f] flex">

      {/* ── Left panel — Branding ───────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-950/40 via-[#07090f] to-indigo-950/30" />
          <div className="absolute top-1/3 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl" />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full px-16 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <img
              src="/tekhportal.webp"
              alt="TekhPortal"
              className="h-10 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>

          {/* Headline */}
          <div className="py-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">All-in-one CRM Platform</span>
            </div>

            <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Grow faster with<br />
              <span className="text-gradient">smarter tools</span>
            </h1>
            <p className="text-slate-500 text-base leading-relaxed max-w-md">
              Manage your leads, automate WhatsApp campaigns, capture Meta Ads data, and make decisions backed by real analytics.
            </p>

            {/* Feature cards */}
            <div className="mt-10 grid grid-cols-2 gap-3">
              {features.map(({ icon: Icon, label, sub, color, bg, border }) => (
                <div key={label} className={`p-4 rounded-2xl border ${border} ${bg} flex flex-col gap-2`}>
                  <div className={`w-8 h-8 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                    <Icon size={15} className={color} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-8 flex items-center gap-6">
              {[
                { val: '10K+', label: 'Leads managed' },
                { val: '99.9%', label: 'Uptime SLA' },
                { val: '5×',   label: 'ROI increase' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <p className="text-xl font-bold text-gradient">{val}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-600">© {new Date().getFullYear()} TekhPortal · All rights reserved</p>
        </div>
      </div>

      {/* ── Right panel — Login Form ───────────────── */}
      <div className="flex-1 lg:max-w-[480px] flex items-center justify-center px-6 py-12 bg-slate-950/50 border-l border-slate-200">
        <div className="w-full max-w-sm animate-slide-up">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10">
            <img
              src="/tekhportal.webp"
              alt="TekhPortal"
              className="h-8 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className="font-bold text-slate-900 text-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>TekhPortal</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Sign in to your account
            </h2>
            <p className="text-sm text-slate-500">Enter your admin credentials to access the dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-10"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pl-10 pr-11"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-[15px] mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <>Sign in <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-600">
            Secure access · Powered by TekhPortal CRM
          </p>
        </div>
      </div>
    </div>
  )
}
