import { useState, FormEvent, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Animated stat counter ── */
function AnimatedCounter({ to, label, suffix = '' }: { to: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        let start = 0
        const step = Math.ceil(to / 40)
        const timer = setInterval(() => {
          start += step
          if (start >= to) { setCount(to); clearInterval(timer) }
          else setCount(start)
        }, 30)
      }
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [to])
  
  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl lg:text-3xl font-black text-white tabular-nums" style={{letterSpacing: '-0.04em'}}>{count}{suffix}</p>
      <p className="text-white/50 text-[10px] lg:text-xs font-semibold mt-0.5 uppercase tracking-widest">{label}</p>
    </div>
  )
}

export default function Login() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const { login }                       = useAuth()
  const navigate                        = useNavigate()

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
        err?.code === 'auth/invalid-credential' ? 'Invalid email or password' :
        err?.code === 'auth/user-not-found' ? 'No account found with this email' :
        err?.message || 'Sign in failed. Please try again.'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes morphBlob {
          0%   { border-radius: 60% 40% 30% 70%/60% 30% 70% 40%; }
          50%  { border-radius: 30% 60% 70% 40%/50% 60% 30% 60%; }
          100% { border-radius: 60% 40% 30% 70%/60% 30% 70% 40%; }
        }
        @keyframes scanLine {
          0%   { transform: translateY(-100%); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(400%); opacity: 0; }
        }
        @keyframes spinSlow {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100">

        {/* ══ LEFT — Animated hero panel (Hidden on small mobile, visible on tablet/desktop) ════════════════════════════ */}
        <div className="hidden md:flex flex-col flex-1 relative overflow-hidden min-h-[40vh] lg:min-h-screen" style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 35%, #2563eb 60%, #4f46e5 100%)',
          backgroundSize: '300% 300%',
          animation: 'gradientShift 8s ease infinite',
        }}>

          {/* Morphing blob 1 */}
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #60a5fa, transparent 70%)',
              animation: 'morphBlob 10s ease-in-out infinite',
            }} />

          {/* Morphing blob 2 */}
          <div className="absolute -bottom-40 -right-20 w-[600px] h-[600px] opacity-15 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #a78bfa, transparent 70%)',
              animation: 'morphBlob 14s ease-in-out infinite reverse',
            }} />

          {/* Dot grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)', backgroundSize: '28px 28px'}} />

          {/* Animated scan line */}
          <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-300/60 to-transparent pointer-events-none"
            style={{animation: 'scanLine 6s ease-in-out infinite', animationDelay: '2s'}} />

          {/* Spinning ring decoration */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-white/10 pointer-events-none"
            style={{animation: 'spinSlow 40s linear infinite'}} />

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full px-8 py-10 lg:px-16 lg:py-16 justify-between max-w-2xl mx-auto w-full">
            <div className="animate-fade-in">
              <img
                src="/tekhportal.webp"
                alt="TekhPortal"
                className="h-10 lg:h-14 w-auto object-contain brightness-0 invert opacity-90"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>

            <div className="flex-1 flex flex-col justify-center py-10">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-xs font-bold text-white/90 mb-6 w-fit backdrop-blur-sm shadow-xl">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                All-in-One Business CRM Suite
              </div>
              
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.1] mb-6 drop-shadow-lg" style={{letterSpacing: '-0.03em'}}>
                Work smarter,<br />
                <span className="text-blue-300">grow faster.</span>
              </h1>
              
              <p className="text-blue-50/90 text-sm lg:text-base xl:text-lg leading-relaxed max-w-md font-medium mb-12 drop-shadow">
                The unified platform to manage leads, automate marketing, and scale your business — all in one place.
              </p>

              {/* Live stats bar */}
              <div className="flex items-center gap-6 lg:gap-10 bg-black/20 border border-white/10 backdrop-blur-md rounded-2xl px-6 py-5 lg:px-8 lg:py-6 w-fit shadow-2xl">
                <AnimatedCounter to={2400}  label="Leads" suffix="+" />
                <div className="w-px h-10 bg-white/10" />
                <AnimatedCounter to={98}    label="Uptime" suffix="%" />
                <div className="w-px h-10 bg-white/10" />
                <AnimatedCounter to={340}   label="Users" suffix="+" />
              </div>
            </div>

            <p className="text-white/40 text-xs font-medium animate-fade-in">
              © {new Date().getFullYear()} TekhPortal CRM. Secure & Encrypted.
            </p>
          </div>
        </div>

        {/* ══ RIGHT — Login form ═════════════════════════════════════ */}
        <div className="flex-1 lg:max-w-[480px] xl:max-w-[560px] flex items-center justify-center p-6 lg:p-12 bg-white shadow-[-20px_0_40px_-10px_rgba(0,0,0,0.1)] relative z-20 min-h-screen md:min-h-0">
          <div className="w-full max-w-[380px] animate-slide-up">

            {/* Mobile logo (Visible only on small screens) */}
            <div className="flex md:hidden items-center mb-12">
              <img
                src="/tekhportal.webp"
                alt="TekhPortal"
                className="h-10 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>

            {/* Heading */}
            <div className="mb-10">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2" style={{letterSpacing: '-0.03em'}}>
                Sign in
              </h2>
              <p className="text-slate-500 font-medium">
                Enter your credentials to access your dashboard.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email address</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-blue-600" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium transition-all focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Password</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-blue-600" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm font-medium transition-all focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-blue-600 text-white font-bold text-[15px] shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-70 disabled:pointer-events-none"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    <>Sign in <ArrowRight size={18} /></>
                  )}
                </button>
              </div>
            </form>

            <p className="mt-10 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Secure Access
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
