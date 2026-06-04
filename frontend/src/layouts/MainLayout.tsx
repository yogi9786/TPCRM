import { ReactNode, useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden relative">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[100px] animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-400/10 blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-emerald-400/5 blur-[120px] animate-blob animation-delay-4000" />
      </div>

      {/* Sidebar */}
      <div className="z-10 relative">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden z-10 relative">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/40 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <img src="/tekhportal.webp" alt="TekhPortal" className="h-8 w-auto object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 bg-white/70 backdrop-blur-sm border border-slate-200/60 rounded-xl text-slate-700 hover:bg-white shadow-sm transition-all"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-0">
          {children}
        </div>
      </main>
    </div>
  )
}
