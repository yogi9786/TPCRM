import { useState, FormEvent, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Zap, Users, BarChart3, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'


export default function Login() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const { login }                       = useAuth()
  const navigate                        = useNavigate()

  const glowRef = useRef<HTMLDivElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX - 200}px, ${e.clientY - 200}px)`
      }
      if (parallaxRef.current) {
        const x = (e.clientX / window.innerWidth - 0.5) * -40
        const y = (e.clientY / window.innerHeight - 0.5) * -40
        parallaxRef.current.style.transform = `translate(${x}px, ${y}px)`
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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
        @keyframes gradientDrift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes scanLine {
          0%   { transform: translateY(-200%); opacity: 0; }
          20%  { opacity: 0.6; }
          80%  { opacity: 0.6; }
          100% { transform: translateY(600%); opacity: 0; }
        }
        @keyframes spinOrbit { to { transform: rotate(360deg); } }
        @keyframes goldGlow {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.65; }
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(50px, -50px) scale(1.1); }
          66%      { transform: translate(-30px, 20px) scale(0.9); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(-50px, 30px) scale(1.2); }
          66%      { transform: translate(40px, -40px) scale(0.8); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(30px, 50px) scale(0.9); }
          66%      { transform: translate(-40px, -20px) scale(1.1); }
        }
      `}</style>

      <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden" 
           style={{ background: 'linear-gradient(150deg, #0c0b6e 0%, #100F88 40%, #1a19c0 80%, #2020b8 100%)', backgroundSize: '300% 300%', animation: 'gradientDrift 10s ease infinite' }}>

        {/* ══ FULLSCREEN ANIMATED BACKGROUND ══ */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          
          {/* Interactive Mouse Glow */}
          <div ref={glowRef} className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full mix-blend-screen opacity-70 blur-[70px] z-20 will-change-transform hidden md:block" 
               style={{ background: 'radial-gradient(circle, rgba(255,194,99,0.35) 0%, transparent 70%)', transition: 'transform 0.1s cubic-bezier(0.2, 0.8, 0.2, 1)' }} />

          {/* Parallax Container */}
          <div ref={parallaxRef} className="absolute inset-[-50px] will-change-transform" style={{ transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
            {/* Dot grid background */}
            <div className="absolute inset-0"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

            {/* Floating dynamic blobs */}
            <div className="absolute top-0 left-10 w-80 h-80 rounded-full mix-blend-screen opacity-40 blur-[80px]" 
                 style={{ background: '#FFC263', animation: 'float1 14s ease-in-out infinite' }} />
            <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full mix-blend-screen opacity-30 blur-[100px]" 
                 style={{ background: '#4d4bdf', animation: 'float2 18s ease-in-out infinite' }} />
            <div className="absolute top-1/3 left-1/3 w-72 h-72 rounded-full mix-blend-screen opacity-20 blur-[60px]" 
                 style={{ background: '#f0a832', animation: 'float3 12s ease-in-out infinite' }} />

            {/* Gold glow orb top-left */}
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,194,99,0.18) 0%, transparent 70%)', animation: 'goldGlow 4s ease-in-out infinite, float1 20s ease-in-out infinite' }} />

            {/* Gold glow orb bottom-right */}
            <div className="absolute -bottom-32 -right-32 w-[520px] h-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,194,99,0.12) 0%, transparent 70%)', animation: 'goldGlow 6s ease-in-out infinite reverse, float2 24s ease-in-out infinite' }} />

            {/* Scan line */}
            <div className="absolute left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,194,99,0.5), transparent)', animation: 'scanLine 8s ease-in-out infinite' }} />

            {/* Spinning orbit rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
              <div className="w-[600px] h-[600px] rounded-full border border-white/5" style={{ animation: 'spinOrbit 60s linear infinite' }} />
              <div className="absolute inset-8 rounded-full border border-white/8" style={{ animation: 'spinOrbit 40s linear infinite reverse' }} />
              <div className="absolute inset-20 rounded-full border border-white/6" style={{ animation: 'spinOrbit 25s linear infinite' }} />
            </div>
          </div>
        </div>

        {/* ══ LEFT — Hero panel ══════════════════════════════════════════════ */}
        <div className="hidden md:flex flex-col flex-1 relative z-10">

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full px-10 py-10 lg:px-14 lg:py-12 justify-between max-w-2xl transition-transform duration-500 hover:-translate-y-2 hover:scale-[1.02]">

            {/* Logo */}
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="bg-white p-3 rounded-2xl shadow-lg">
                <img src="/tekhportal.webp" alt="TekhPortal" className="h-16 lg:h-24 w-auto object-contain" />
              </div>
            </div>

            {/* Main copy */}
            <div className="flex-1 flex flex-col justify-center py-12">
              <h1 className="text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-5" style={{ letterSpacing: '-0.035em' }}>
                Welcome to<br />
                <span style={{ color: '#FFC263' }}>TekhPortal CRM.</span>
              </h1>

              <p className="text-sm lg:text-base leading-relaxed max-w-sm font-medium mb-10" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Internal management portal for leads, clients, campaigns, and team collaboration.
              </p>
            </div>

            <p className="text-[11px] font-medium animate-fade-in" style={{ color: 'rgba(255,255,255,0.35)' }}>
              © {new Date().getFullYear()} TekhPortal CRM — Secure & Encrypted
            </p>
          </div>
        </div>

        {/* ══ RIGHT — Login form ══════════════════════════════════════════════ */}
        <div className="flex-1 lg:max-w-[500px] xl:max-w-[560px] flex items-center justify-center p-4 sm:p-8 lg:p-12 relative z-20 min-h-screen md:min-h-0 md:bg-white"
          style={{ boxShadow: '-16px 0 48px rgba(16,15,136,0.12)' }}>
          <div className="w-full max-w-[400px] bg-white/95 md:bg-transparent backdrop-blur-2xl md:backdrop-blur-none p-8 md:p-0 rounded-3xl md:rounded-none shadow-2xl md:shadow-none animate-slide-up">

            {/* Mobile logo */}
            <div className="flex md:hidden items-center gap-3 mb-10 transition-transform duration-500 hover:-translate-y-1 hover:scale-105">
              <img src="/tekhportal.webp" alt="TekhPortal" className="h-20 w-auto object-contain" />
            </div>

            {/* Heading */}
            <div className="mb-8">
              <div className="w-12 h-1 rounded-full mb-5" style={{ background: 'linear-gradient(90deg, #100F88, #FFC263)' }} />
              <h2 className="text-3xl font-black leading-tight mb-2" style={{ color: '#100F88', letterSpacing: '-0.03em' }}>Welcome back</h2>
              <p className="text-sm font-medium" style={{ color: '#5a5898' }}>Sign in to access your TekhPortal dashboard.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#5a5898' }}>Email Address</label>
                <div className="relative group">
                  <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" style={{ color: '#9896cc' }} />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm font-medium transition-all outline-none"
                    style={{
                      background: '#f0f0f9',
                      border: '1.5px solid #d8d8ee',
                      color: '#0d0c50',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#100F88'
                      e.target.style.background = '#fff'
                      e.target.style.boxShadow = '0 0 0 3px rgba(16,15,136,0.12)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#d8d8ee'
                      e.target.style.background = '#f0f0f9'
                      e.target.style.boxShadow = 'none'
                    }}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#5a5898' }}>Password</label>
                <div className="relative group">
                  <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9896cc' }} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your secure password"
                    className="w-full pl-11 pr-12 py-3.5 rounded-xl text-sm font-medium transition-all outline-none"
                    style={{
                      background: '#f0f0f9',
                      border: '1.5px solid #d8d8ee',
                      color: '#0d0c50',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#100F88'
                      e.target.style.background = '#fff'
                      e.target.style.boxShadow = '0 0 0 3px rgba(16,15,136,0.12)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#d8d8ee'
                      e.target.style.background = '#f0f0f9'
                      e.target.style.boxShadow = 'none'
                    }}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: '#9896cc' }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-white font-black text-sm transition-all disabled:opacity-60 disabled:pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, #100F88, #1a19c0)',
                    boxShadow: '0 4px 20px rgba(16,15,136,0.40), inset 0 1px 0 rgba(255,255,255,0.10)',
                    letterSpacing: '0.01em',
                  }}
                  onMouseEnter={e => {
                    if (!loading) (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = ''
                  }}
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
                    <>Sign in <ArrowRight size={17} /></>
                  )}
                </button>
              </div>
            </form>

            {/* Gold divider footer */}
            <div className="mt-10 pt-6 border-t" style={{ borderColor: '#e4e4f0' }}>
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, #FFC263)' }} />
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#9896cc' }}>Secure Login</p>
                <div className="w-4 h-px" style={{ background: 'linear-gradient(90deg, #FFC263, transparent)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
