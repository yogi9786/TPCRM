import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, MessageCircle, Share2, Megaphone,
  Settings, LogOut, ChevronLeft, ChevronRight,
  MessageSquare, Mail, CalendarDays, X
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { to: '/crm', icon: Users, label: 'CRM Leads' },
    ]
  },
  {
    label: 'Marketing',
    items: [
      { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
      { to: '/content-planner', icon: CalendarDays, label: 'Content Planner' },
      { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
      { to: '/email', icon: Mail, label: 'Email' },
      { to: '/meta', icon: Share2, label: 'Meta Ads' },
      { to: '/livechat', icon: MessageSquare, label: 'Live Chat' },
    ]
  },
]

interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  const sidebarContent = (
    <aside
      className={clsx(
        'flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 ease-out overflow-hidden',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* ── Logo ───────────────────────────────────── */}
      <div className={clsx(
        'flex items-center gap-3 border-b border-slate-100 flex-shrink-0 transition-all duration-300',
        collapsed ? 'justify-center px-3 py-4' : 'px-5 py-3'
      )}>
        <img
          src="/tekhportal.webp"
          alt="TekhPortal"
          className={clsx('object-contain flex-shrink-0 transition-all duration-300', collapsed ? 'h-8 w-8' : 'h-16 w-auto max-w-[160px]')}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.display = 'none'
            const fallback = el.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        {/* Fallback text */}
        {!collapsed && (
          <div className="hidden items-center gap-2 min-w-0">
            <span className="font-bold text-slate-900 text-sm">TekhPortal</span>
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────── */}
      <nav className="flex-1 py-3 px-2.5 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 select-none">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, exact }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={exact}
                  onClick={onMobileClose}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ease-out group relative',
                    collapsed && 'justify-center',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} className={clsx(
                        'flex-shrink-0 transition-all duration-150',
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
                      )} />
                      {!collapsed && <span className="truncate leading-none">{label}</span>}
                      {/* Active indicator dot for collapsed */}
                      {collapsed && isActive && (
                        <span className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Settings nav link ───────────────────────── */}
      <div className="px-2.5 pb-2 border-t border-slate-100">
        <NavLink
          to="/settings"
          onClick={onMobileClose}
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) => clsx(
            'flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl text-sm font-semibold transition-all duration-150 ease-out',
            collapsed && 'justify-center',
            isActive ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          {({ isActive }) => (
            <>
              <Settings size={16} className={clsx('flex-shrink-0', isActive ? 'text-white' : 'text-slate-400')} />
              {!collapsed && <span>Settings</span>}
            </>
          )}
        </NavLink>
      </div>

      {/* ── User footer ────────────────────────────── */}
      <div className={clsx(
        'border-t border-slate-100 p-2.5 flex-shrink-0 space-y-1'
      )}>
        <div className={clsx(
          'flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors hover:bg-slate-50 cursor-default',
          collapsed && 'justify-center'
        )}>
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
            {currentUser?.email?.charAt(0).toUpperCase() ?? 'A'}
          </div>
          {!collapsed && (
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                {currentUser?.displayName || 'Admin'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{currentUser?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={clsx(
            'flex items-center gap-3 w-full px-2.5 py-2 rounded-xl text-sm font-semibold text-slate-500 transition-all duration-150 hover:bg-red-50 hover:text-red-600 group',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={15} className="flex-shrink-0 group-hover:rotate-12 transition-transform duration-200" />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            'hidden lg:flex items-center gap-3 w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-400 transition-all duration-150 hover:bg-slate-100 hover:text-slate-600',
            collapsed && 'justify-center'
          )}
        >
          {collapsed
            ? <ChevronRight size={14} />
            : <><ChevronLeft size={14} /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">{sidebarContent}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="relative z-10 w-[240px] h-full shadow-2xl animate-slide-up">
            {sidebarContent}
          </div>
          <button
            onClick={onMobileClose}
            className="absolute top-4 left-[248px] z-20 p-2 rounded-xl bg-white text-slate-500 hover:text-slate-900 shadow-md border border-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
