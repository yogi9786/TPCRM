import { ReactNode, useState } from 'react'
import { Menu, Zap } from 'lucide-react'
import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-noise" style={{ background: 'var(--bg)' }}>
      {/* ── Maximalist Animated Background Orbs ─────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full mix-blend-multiply opacity-20 blur-[100px]" style={{ background: 'var(--navy)' }} />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] rounded-full mix-blend-multiply opacity-20 blur-[100px]" style={{ background: 'var(--purple)' }} />
        <div className="absolute -bottom-40 left-1/3 w-[700px] h-[700px] rounded-full mix-blend-multiply opacity-15 blur-[120px]" style={{ background: 'var(--gold)' }} />
      </div>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="relative z-20">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      </div>

      {/* ── Main content area ────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-10 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, var(--navy) 0%, var(--navy-light) 100%)',
            boxShadow: '0 4px 16px rgba(30,18,168,0.4)',
          }}
        >
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <img
              src="/tekhportal.webp"
              alt="TekhPortal"
              className="h-12 w-auto object-contain"
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                const fallback = el.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            {/* Fallback */}
            <div className="hidden items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', boxShadow: '0 2px 8px rgba(255,183,3,0.40)' }}
              >
                <Zap size={16} color="var(--navy-dark)" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-none">TekhPortal</p>
                <p className="text-[9px] font-bold uppercase tracking-widest leading-tight" style={{ color: 'var(--gold)' }}>CRM Suite</p>
              </div>
            </div>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl transition-all"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.20)',
              color: 'white',
            }}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Scrollable page content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
          <div className="p-3 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
