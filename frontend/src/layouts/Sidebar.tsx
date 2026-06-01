import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  Share2,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',  exact: true },
  { to: '/crm',       icon: Users,           label: 'CRM Leads' },
  { to: '/livechat',  icon: MessageSquare,   label: 'Live Chat' },
  { to: '/whatsapp',  icon: MessageCircle,   label: 'WhatsApp' },
  { to: '/meta',      icon: Share2,          label: 'Meta Ads' },
  { to: '/campaigns', icon: Megaphone,       label: 'Campaigns' },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
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
        'flex flex-col h-full bg-slate-900 border-r border-slate-800/50 transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-4 border-b border-slate-800/50 flex-shrink-0',
          collapsed && 'justify-center px-2'
        )}
      >
        <img
          src="/tekhportal.webp"
          alt="TekhPortal"
          className={clsx('object-contain flex-shrink-0', collapsed ? 'h-8 w-8' : 'h-9 w-auto max-w-[140px]')}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.display = 'none'
            const fallback = el.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        {/* Fallback text logo (hidden when image loads) */}
        {!collapsed && (
          <div
            className="hidden items-center gap-2 min-w-0"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <span className="font-bold text-white text-sm truncate">TekhPortal</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={onMobileClose}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
                collapsed && 'justify-center'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  className={clsx(
                    'flex-shrink-0 transition-colors',
                    isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-200'
                  )}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-800/50 space-y-1 flex-shrink-0">
        {/* User avatar + info */}
        <div
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl',
            collapsed && 'justify-center'
          )}
        >
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
            {currentUser?.email?.charAt(0).toUpperCase() ?? 'A'}
          </div>
          {!collapsed && (
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.displayName || 'Admin'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{currentUser?.email}</p>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={clsx(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150',
            collapsed && 'justify-center'
          )}
        >
          <LogOut size={15} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            'hidden lg:flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 hover:bg-slate-800/40 transition-all duration-150',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronRight size={13} /> : <><ChevronLeft size={13} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">{sidebarContent}</div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="relative z-10 w-[220px] h-full">
            {sidebarContent}
          </div>
          <button
            onClick={onMobileClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
