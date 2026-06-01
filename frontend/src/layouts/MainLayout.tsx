import { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0a0f1a] overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
