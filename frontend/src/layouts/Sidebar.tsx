import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, MessageCircle, Share2, Megaphone,
  Settings, LogOut, ChevronLeft, ChevronRight, BarChart3,
  MessageSquare, Mail, CalendarDays, X, UserCheck, Building2,
  Zap
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/',        icon: LayoutDashboard, label: 'Dashboard',      exact: true },
      { to: '/crm',     icon: Users,           label: 'CRM Leads'              },
      { to: '/clients', icon: Building2,        label: 'Clients'                },
      { to: '/team',    icon: UserCheck,        label: 'Team'                   },
    ]
  },
  {
    label: 'Marketing',
    items: [
      { to: '/campaigns',       icon: Megaphone,      label: 'Campaigns'        },
      { to: '/content-planner', icon: CalendarDays,   label: 'Content Planner'  },
      { to: '/whatsapp',        icon: MessageCircle,  label: 'WhatsApp'         },
      { to: '/email',           icon: Mail,           label: 'Email'            },
      { to: '/meta',            icon: Share2,         label: 'Meta Ads'         },
      { to: '/livechat',        icon: MessageSquare,  label: 'Live Chat'        },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
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

  const avatarLetter = currentUser?.email?.charAt(0).toUpperCase() ?? 'A'
  const displayName  = currentUser?.displayName || 'Admin'

  const sidebarContent = (
    <aside
      className={clsx(
        'flex flex-col h-full transition-all duration-300 ease-out overflow-hidden relative',
        collapsed ? 'w-[72px]' : 'w-[256px]'
      )}
      style={{ background: 'linear-gradient(180deg, var(--navy) 0%, var(--navy-dark) 100%)' }}
    >
      {/* Decorative dot grid */}
      <div
        className="absolute inset-0 pointer-events-none select-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      {/* Decorative gold orb top-right */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(255,194,99,0.12) 0%, transparent 70%)' }}
      />

      {/* ── Logo ─────────────────────────────────────────────── */}
      <div className={clsx(
        'relative flex items-center gap-3 flex-shrink-0 transition-all duration-300',
        'border-b',
        collapsed ? 'justify-center px-3 py-3' : 'px-4 py-3'
      )}
        style={{ borderColor: 'rgba(255,255,255,0.10)' }}
      >
        {collapsed ? (
          /* Collapsed: show small Zap icon mark */
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl w-10 h-10"
            style={{
              background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
              boxShadow: '0 4px 12px rgba(255,183,3,0.45)',
            }}
          >
            <Zap size={20} color="var(--navy-dark)" strokeWidth={2.5} />
          </div>
        ) : (
          /* Expanded: show full logo image */
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/tekhportal.webp"
              alt="TekhPortal"
              className="h-16 w-auto object-contain flex-shrink-0"
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                const fallback = el.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            {/* Fallback if logo fails */}
            <div className="hidden items-center gap-2.5">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-xl w-9 h-9"
                style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))', boxShadow: '0 4px 12px rgba(255,183,3,0.45)' }}
              >
                <Zap size={18} color="var(--navy-dark)" strokeWidth={2.5} />
              </div>
              <div>
                <p className="font-black text-white text-sm leading-none tracking-tight">TekhPortal</p>
                <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--gold)' }}>CRM Suite</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p
                className="px-2 mb-2 text-[9px] font-black uppercase tracking-[0.18em] select-none"
                style={{ color: 'rgba(255,194,99,0.55)' }}
              >
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
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ease-out group relative overflow-hidden',
                    collapsed && 'justify-center',
                    isActive
                      ? 'text-navy-600'
                      : 'hover:bg-white/8'
                  )}
                  style={({ isActive }) => isActive ? {
                    background: 'linear-gradient(135deg, rgba(255,183,3,0.22) 0%, rgba(255,183,3,0.08) 100%)',
                    border: '1px solid rgba(255,183,3,0.30)',
                    color: 'var(--gold)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.20)',
                  } : {
                    color: 'rgba(255,255,255,0.60)',
                    border: '1px solid transparent',
                  }}
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={17}
                        className="flex-shrink-0 transition-all duration-150"
                        style={{ color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.55)' }}
                      />
                      {!collapsed && (
                        <span
                          className="truncate leading-none font-semibold"
                          style={{ color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.75)' }}
                        >
                          {label}
                        </span>
                      )}
                      {/* Active left bar */}
                      {isActive && !collapsed && (
                        <span
                          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                          style={{ background: 'var(--gold)' }}
                        />
                      )}
                      {/* Collapsed active dot */}
                      {collapsed && isActive && (
                        <span
                          className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full"
                          style={{ background: 'var(--gold)' }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Settings ─────────────────────────────────────────── */}
      <div
        className="px-3 pb-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <NavLink
          to="/settings"
          onClick={onMobileClose}
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) => clsx(
            'flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl text-sm font-semibold transition-all duration-150 ease-out',
            collapsed && 'justify-center'
          )}
          style={({ isActive }) => isActive ? {
            background: 'linear-gradient(135deg, rgba(255,183,3,0.22), rgba(255,183,3,0.08))',
            border: '1px solid rgba(255,183,3,0.30)',
            color: 'var(--gold)',
          } : {
            color: 'rgba(255,255,255,0.60)',
            border: '1px solid transparent',
          }}
        >
          {({ isActive }) => (
            <>
              <Settings size={17} style={{ color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.55)' }} />
              {!collapsed && (
                <span style={{ color: isActive ? 'var(--gold)' : 'rgba(255,255,255,0.75)' }}>Settings</span>
              )}
            </>
          )}
        </NavLink>
      </div>

      {/* ── User footer ──────────────────────────────────────── */}
      <div
        className="p-3 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Avatar + name */}
        <div className={clsx(
          'flex items-center gap-3 px-2.5 py-2.5 rounded-xl mb-1',
          collapsed && 'justify-center'
        )}
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black select-none"
            style={{
              background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
              color: 'var(--navy-dark)',
              boxShadow: '0 2px 8px rgba(255,183,3,0.40)',
            }}
          >
            {avatarLetter}
          </div>
          {!collapsed && (
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">{displayName}</p>
              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>{currentUser?.email}</p>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={clsx(
            'flex items-center gap-3 w-full px-2.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 group',
            collapsed && 'justify-center'
          )}
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'
            ;(e.currentTarget as HTMLElement).style.color = '#fca5a5'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'
          }}
        >
          <LogOut size={15} className="flex-shrink-0 transition-transform duration-200 group-hover:rotate-12" />
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            'hidden lg:flex items-center gap-3 w-full px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150',
            collapsed && 'justify-center'
          )}
          style={{ color: 'rgba(255,255,255,0.30)' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.30)'
          }}
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
            className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(30,18,168,0.55)' }}
            onClick={onMobileClose}
          />
          <div className="relative z-10 w-[256px] h-full shadow-2xl animate-slide-up">
            {sidebarContent}
          </div>
          <button
            onClick={onMobileClose}
            className="absolute top-4 left-[264px] z-20 p-2 rounded-xl text-white shadow-md transition-colors"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}
