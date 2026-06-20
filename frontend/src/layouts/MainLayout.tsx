import { ReactNode, useState } from 'react'
import { Menu, Zap } from 'lucide-react'
import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f0f9' }}>

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
            background: 'linear-gradient(90deg, #100F88 0%, #1a19c0 100%)',
            boxShadow: '0 2px 12px rgba(16,15,136,0.35)',
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
                style={{ background: 'linear-gradient(135deg, #FFC263, #f0a832)', boxShadow: '0 2px 8px rgba(255,194,99,0.40)' }}
              >
                <Zap size={16} color="#100F88" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-white font-black text-sm leading-none">TekhPortal</p>
                <p className="text-[9px] font-bold uppercase tracking-widest leading-tight" style={{ color: '#FFC263' }}>CRM Suite</p>
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
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-3 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
