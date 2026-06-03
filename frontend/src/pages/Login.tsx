import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowRight, MessageCircle, Share2, BarChart3, Users } from 'lucide-react'
import toast from 'react-hot-toast'


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
    <div className="min-h-screen bg-slate-50 flex">

      {/* ── Left panel — Branding ───────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden bg-white border-r border-slate-200">
        
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
          
          {/* Light subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full px-16 py-12 justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3 animate-slide-up">
            <img
              src="/tekhportal.webp"
              alt="TekhPortal"
              className="h-24 w-auto object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>

          {/* Hero Content */}
          <div className="max-w-xl animate-slide-up delay-75">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 mb-6 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">Next-Gen CRM</span>
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Work <span className="text-gradient">smarter</span>,<br />
              grow faster.
            </h1>
            
            <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-md">
              The all-in-one platform to manage your leads, automate conversations, and scale your business with ease.
            </p>

            {/* Floating visual elements representing tools */}
            <div className="flex items-center gap-4 animate-float">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-xl border border-slate-100 text-blue-500">
                <Users size={24} strokeWidth={2.5} />
              </div>
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-xl border border-slate-100 text-emerald-500 transform translate-y-4">
                <MessageCircle size={24} strokeWidth={2.5} />
              </div>
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-xl border border-slate-100 text-violet-500">
                <Share2 size={24} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <p className="text-sm font-medium text-slate-400 animate-slide-up delay-150">
            © {new Date().getFullYear()} TekhPortal CRM. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right panel — Login Form ───────────────── */}
      <div className="flex-1 lg:max-w-[480px] flex items-center justify-center px-6 py-12 bg-white relative z-20 shadow-2xl">
        <div className="w-full max-w-sm">

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
          <div className="mb-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Sign in to your account
            </h2>
            <p className="text-sm text-slate-500">Enter your admin credentials to access the dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="animate-slide-up delay-75">
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
            <div className="animate-slide-up delay-100">
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
            <div className="animate-slide-up delay-150 pt-2">
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 text-[15px] shadow-blue-500/20 shadow-lg hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
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
            </div>
          </form>

          <p className="mt-8 text-center text-xs text-slate-500 animate-slide-up delay-200">
            Secure access · Powered by TekhPortal CRM
          </p>
        </div>
      </div>
    </div>
  )
}
