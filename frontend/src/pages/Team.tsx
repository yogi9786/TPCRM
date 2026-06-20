import { useState, useEffect } from 'react'
import MainLayout from '../layouts/MainLayout'
import {
  Users, Plus, Mail, Shield, ShieldAlert, Trash2, Loader2,
  Eye, EyeOff, RefreshCw, UserCheck, UserX, Key, Pencil, X,
  ChevronDown, Phone, Building2, CheckCircle2, AlertCircle, Copy, Lock,
  BarChart3, MessageCircle, Send, Settings, FileText, Megaphone
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const API = import.meta.env.VITE_API_URL || 'https://tpcrm.onrender.com'

// ── Role definitions (mirrors backend) ────────────────────────────────────────
const ROLES: Record<string, { label: string; color: string; bg: string; border: string; description: string; perms: string[] }> = {
  admin: {
    label: 'Admin',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    description: 'Full access — all CRM features, settings, billing & team.',
    perms: ['Leads', 'Campaigns', 'Email', 'WhatsApp', 'Meta', 'Analytics', 'Settings', 'Team', 'Documents']
  },
  manager: {
    label: 'Manager',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    description: 'Manage leads, campaigns, analytics and task assignment.',
    perms: ['Leads', 'Campaigns', 'Email', 'WhatsApp', 'Meta', 'Analytics', 'Tasks', 'Documents']
  },
  agent: {
    label: 'Sales Agent',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    description: 'Manage assigned leads and communicate with prospects.',
    perms: ['Leads', 'WhatsApp', 'Email', 'Tasks']
  },
  viewer: {
    label: 'Viewer',
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    description: 'Read-only access to leads and analytics.',
    perms: ['Leads', 'Analytics']
  }
}

const PERM_ICONS: Record<string, JSX.Element> = {
  Leads:     <Users size={11} />,
  Campaigns: <Megaphone size={11} />,
  Email:     <Send size={11} />,
  WhatsApp:  <MessageCircle size={11} />,
  Meta:      <BarChart3 size={11} />,
  Analytics: <BarChart3 size={11} />,
  Settings:  <Settings size={11} />,
  Team:      <Users size={11} />,
  Documents: <FileText size={11} />,
  Tasks:     <CheckCircle2 size={11} />,
}

const DEPARTMENTS = ['Management', 'Sales', 'Marketing', 'Support', 'Operations', 'Engineering', 'Finance']

const EMPTY_FORM = {
  name: '', email: '', username: '', password: '', role: 'agent',
  department: '', phone: '', send_welcome_email: true,
}

const STATUS_STYLE: Record<string, string> = {
  active:   'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-600',
  invited:  'bg-amber-100 text-amber-700',
}

// ── Avatar helper ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600', 'from-purple-500 to-pink-600',
  'from-emerald-500 to-teal-600', 'from-orange-500 to-red-500',
  'from-sky-500 to-cyan-600',
]
function avatarColor(str: string) {
  const idx = str.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

// ── Reusable PasswordField ────────────────────────────────────────────────────
function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [show, setShow] = useState(false)
  const strength = value.length === 0 ? 0 : value.length < 6 ? 1 : value.length < 10 ? 2 : 3
  const strengthLabel = ['', 'Weak', 'Good', 'Strong']
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-500']
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'Set a secure password'}
          className="input-field pl-10 pr-10"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex gap-1 flex-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={clsx('h-1 flex-1 rounded-full transition-all', i <= strength ? strengthColor[strength] : 'bg-slate-200')} />
            ))}
          </div>
          <span className={clsx('text-[10px] font-bold', strength === 1 ? 'text-red-500' : strength === 2 ? 'text-amber-500' : 'text-emerald-600')}>
            {strengthLabel[strength]}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Team() {
  const { currentUser } = useAuth()
  const [members, setMembers]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modals
  const [showAddModal, setShowAddModal]         = useState(false)
  const [showEditModal, setShowEditModal]       = useState<any | null>(null)
  const [showDeleteModal, setShowDeleteModal]   = useState<any | null>(null)
  const [showResetModal, setShowResetModal]     = useState<any | null>(null)
  const [showDetailModal, setShowDetailModal]   = useState<any | null>(null)

  // Form state
  const [form, setForm]       = useState({ ...EMPTY_FORM })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // Filter
  const [filterRole, setFilterRole] = useState('all')
  const [search, setSearch] = useState('')

  async function fetchMembers(quiet = false) {
    if (!currentUser) return
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const token = await currentUser.getIdToken()
      const res = await fetch(`${API}/team/members`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) setMembers(await res.json())
    } catch { /* silent */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchMembers() }, [currentUser])

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  function autoGeneratePassword() {
    const pwd = generatePassword()
    setForm(f => ({ ...f, password: pwd }))
  }

  async function handleAddMember() {
    if (!form.name.trim())     return toast.error('Full name is required')
    if (!form.email.trim())    return toast.error('Email is required')
    if (!form.username.trim()) return toast.error('Username is required')
    if (!form.password)        return toast.error('Password is required')
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters')
    setSaving(true)
    try {
      const token = await currentUser!.getIdToken()
      const res = await fetch(`${API}/team/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to create member')
      toast.success(`✅ ${form.name} added to the team!`)
      setShowAddModal(false)
      setForm({ ...EMPTY_FORM })
      fetchMembers(true)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSave() {
    if (!showEditModal) return
    setSaving(true)
    try {
      const token = await currentUser!.getIdToken()
      const res = await fetch(`${API}/team/members/${showEditModal.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: showEditModal.name,
          role: showEditModal.role,
          department: showEditModal.department,
          phone: showEditModal.phone,
          status: showEditModal.status,
        })
      })
      if (!res.ok) throw new Error('Update failed')
      toast.success('Member updated!')
      setShowEditModal(null)
      fetchMembers(true)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!showDeleteModal) return
    setDeleting(true)
    try {
      const token = await currentUser!.getIdToken()
      await fetch(`${API}/team/members/${showDeleteModal.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Member removed')
      setShowDeleteModal(null)
      fetchMembers(true)
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setDeleting(false)
    }
  }

  async function handleResetPassword() {
    if (!showResetModal || !newPassword) return
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters')
    setResetting(true)
    try {
      const token = await currentUser!.getIdToken()
      const res = await fetch(`${API}/team/members/${showResetModal.id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword })
      })
      if (!res.ok) throw new Error('Reset failed')
      toast.success('Password reset successfully!')
      setShowResetModal(null)
      setNewPassword('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setResetting(false)
    }
  }

  function copyToClipboard(text: string, label = 'Copied!') {
    navigator.clipboard.writeText(text)
    toast.success(label)
  }

  // Filtered members
  const filtered = members.filter(m => {
    const matchRole = filterRole === 'all' || m.role === filterRole
    const q = search.toLowerCase()
    const matchSearch = !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.username?.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const stats = {
    total: members.length,
    active: members.filter(m => m.status === 'active').length,
    admins: members.filter(m => m.role === 'admin').length,
    agents: members.filter(m => m.role === 'agent').length,
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Users className="text-blue-600" size={22} /> Team Management
            </h1>
            <p className="page-subtitle">Add and manage your CRM users, roles and access permissions</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => fetchMembers(true)}
              className="btn-secondary px-3 py-2"
              title="Refresh"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowAddModal(true) }} className="btn-primary">
              <Plus size={15} /> Add Member
            </button>
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Members', value: stats.total,   color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: Users },
            { label: 'Active',        value: stats.active,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: UserCheck },
            { label: 'Admins',        value: stats.admins,  color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  icon: ShieldAlert },
            { label: 'Agents',        value: stats.agents,  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200',  icon: Shield },
          ].map(({ label, value, color, bg, border, icon: Icon }) => (
            <div key={label} className={`glass-card p-4 border ${border} ${bg} flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filter & Search ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Users size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {['all', 'admin', 'manager', 'agent', 'viewer'].map(r => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                  filterRole === r
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                {r === 'all' ? 'All Roles' : ROLES[r]?.label || r}
              </button>
            ))}
          </div>
        </div>

        {/* ── Members Table ──────────────────────────────────────────────────── */}
        <div className="glass-card overflow-hidden border border-slate-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-blue-500" size={28} />
              <p className="text-sm text-slate-500">Loading team members...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Users size={40} className="text-slate-300" />
              <p className="font-semibold text-slate-600">No members found</p>
              <p className="text-sm text-slate-400">
                {search || filterRole !== 'all' ? 'Try a different search or filter' : 'Add your first team member to get started'}
              </p>
              {(!search && filterRole === 'all') && (
                <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowAddModal(true) }} className="btn-primary mt-2">
                  <Plus size={14} /> Add Member
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Member</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Username</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Department</th>
                    <th className="text-left px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Status</th>
                    <th className="text-right px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(member => {
                    const role = ROLES[member.role] || ROLES.agent
                    return (
                      <tr key={member.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setShowDetailModal(member)}
                            className="flex items-center gap-3 text-left w-full"
                          >
                            <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor(member.name || 'A')} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                              {(member.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{member.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{member.email}</p>
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-4 hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">@{member.username}</span>
                            <button onClick={() => copyToClipboard(member.username, 'Username copied!')} className="text-slate-300 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100">
                              <Copy size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border', role.color, role.bg, role.border)}>
                            {member.role === 'admin' ? <ShieldAlert size={10} /> : <Shield size={10} />}
                            {role.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell">
                          <span className="text-sm text-slate-600">{member.department || <span className="text-slate-400 italic">—</span>}</span>
                        </td>
                        <td className="px-4 py-4 hidden lg:table-cell">
                          <span className={clsx('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide', STATUS_STYLE[member.status] || STATUS_STYLE.active)}>
                            {member.status || 'active'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setShowEditModal({ ...member })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit member"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => { setShowResetModal(member); setNewPassword('') }}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Reset password"
                            >
                              <Key size={15} />
                            </button>
                            {member.uid !== currentUser?.uid && member.id !== currentUser?.uid && (
                              <button
                                onClick={() => setShowDeleteModal(member)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove member"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Member Modal ────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-[95vw] sm:max-w-xl max-h-[85vh] overflow-y-auto custom-scrollbar border-slate-200 animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add Team Member</h2>
                <p className="text-xs text-slate-500 mt-0.5">Create an account with login credentials and send a welcome email</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input
                    className="input-field"
                    placeholder="e.g. Rahul Sharma"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Email Address *</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      className="input-field pl-9"
                      placeholder="member@company.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Username *</label>
                  <input
                    className="input-field font-mono"
                    placeholder="e.g. rahul.sharma"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '.') }))}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Lowercase, no spaces. Used to login.</p>
                </div>
                <div>
                  <label className="label">Phone (Optional)</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      className="input-field pl-9"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="label mb-0">Password *</span>
                  <button
                    type="button"
                    onClick={autoGeneratePassword}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                  >
                    <RefreshCw size={11} /> Auto-generate
                  </button>
                </div>
                <PasswordField
                  label=""
                  value={form.password}
                  onChange={v => setForm(f => ({ ...f, password: v }))}
                  placeholder="Set a strong password"
                />
                {form.password && (
                  <button onClick={() => copyToClipboard(form.password, 'Password copied!')} className="mt-1 text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1">
                    <Copy size={10} /> Copy password
                  </button>
                )}
              </div>

              {/* Role selection */}
              <div>
                <label className="label">Role *</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROLES).map(([key, role]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: key }))}
                      className={clsx(
                        'flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left',
                        form.role === key
                          ? `${role.border} ${role.bg} shadow-sm`
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <span className={clsx('flex items-center gap-1.5 font-bold text-sm mb-1', form.role === key ? role.color : 'text-slate-700')}>
                        {key === 'admin' || key === 'manager' ? <ShieldAlert size={13} /> : <Shield size={13} />}
                        {role.label}
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight">{role.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Department & Welcome email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Department</label>
                  <div className="relative">
                    <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select className="select-field pl-9" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-start gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="send_welcome"
                    checked={form.send_welcome_email}
                    onChange={e => setForm(f => ({ ...f, send_welcome_email: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="send_welcome" className="text-sm text-slate-700 cursor-pointer leading-tight">
                    <span className="font-semibold">Send welcome email</span>
                    <br /><span className="text-xs text-slate-400">Includes login URL and credentials</span>
                  </label>
                </div>
              </div>

              {form.send_welcome_email && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                  <Mail size={14} className="flex-shrink-0 mt-0.5" />
                  A professionally designed welcome email with credentials and login link will be sent automatically.
                </div>
              )}

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleAddMember} disabled={saving} className="btn-primary">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Adding...</> : <><Plus size={14} /> Add Member</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Member Modal ──────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Member</h2>
                <p className="text-xs text-slate-500 mt-0.5">{showEditModal.email}</p>
              </div>
              <button onClick={() => setShowEditModal(null)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Full Name</label>
                  <input className="input-field" value={showEditModal.name} onChange={e => setShowEditModal((m: any) => ({ ...m, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="select-field" value={showEditModal.status || 'active'} onChange={e => setShowEditModal((m: any) => ({ ...m, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Role</label>
                  <select className="select-field" value={showEditModal.role} onChange={e => setShowEditModal((m: any) => ({ ...m, role: e.target.value }))}>
                    {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Department</label>
                  <select className="select-field" value={showEditModal.department || ''} onChange={e => setShowEditModal((m: any) => ({ ...m, department: e.target.value }))}>
                    <option value="">Select...</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={showEditModal.phone || ''} onChange={e => setShowEditModal((m: any) => ({ ...m, phone: e.target.value }))} />
              </div>
              <div className="flex gap-3 justify-end border-t border-slate-100 pt-4">
                <button onClick={() => setShowEditModal(null)} className="btn-secondary">Cancel</button>
                <button onClick={handleEditSave} disabled={saving} className="btn-primary">
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ───────────────────────────────────────────── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar border-slate-200 animate-slide-up p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Reset Password</h2>
                <p className="text-xs text-slate-500 mt-0.5">For: <strong>{showResetModal.name}</strong></p>
              </div>
              <button onClick={() => setShowResetModal(null)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="label mb-0">New Password</span>
              <button
                type="button"
                onClick={() => setNewPassword(generatePassword())}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <RefreshCw size={11} /> Auto-generate
              </button>
            </div>
            <PasswordField label="" value={newPassword} onChange={setNewPassword} />
            {newPassword && (
              <button onClick={() => copyToClipboard(newPassword, 'New password copied!')} className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1">
                <Copy size={10} /> Copy new password
              </button>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              The member's current password will be replaced. Notify them of their new password.
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowResetModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={handleResetPassword} disabled={resetting || !newPassword} className="btn-primary">
                {resetting ? <><Loader2 size={14} className="animate-spin" /> Resetting...</> : <><Key size={14} /> Reset Password</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-[95vw] sm:max-w-sm max-h-[85vh] overflow-y-auto custom-scrollbar border-slate-200 animate-slide-up p-4 sm:p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <UserX size={24} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Remove Member?</h3>
              <p className="text-sm text-slate-500 mt-1">
                <strong>{showDeleteModal.name}</strong> will lose all access to the CRM. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <><Loader2 size={14} className="animate-spin" /> Removing...</> : <><Trash2 size={14} /> Remove</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Member Detail Modal ────────────────────────────────────────────── */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto custom-scrollbar border-slate-200 animate-slide-up">
            <div className="relative p-4 sm:p-6 pb-4 sm:pb-5 border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-md z-10">
              <button
                onClick={() => setShowDetailModal(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarColor(showDetailModal.name || 'A')} flex items-center justify-center text-white font-bold text-xl shadow-md`}>
                  {(showDetailModal.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{showDetailModal.name}</h2>
                  <p className="text-sm text-slate-500">{showDetailModal.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {(() => { const r = ROLES[showDetailModal.role] || ROLES.agent; return (
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border', r.color, r.bg, r.border)}>
                        {showDetailModal.role === 'admin' ? <ShieldAlert size={9} /> : <Shield size={9} />} {r.label}
                      </span>
                    )})()}
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', STATUS_STYLE[showDetailModal.status] || STATUS_STYLE.active)}>
                      {showDetailModal.status || 'active'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Username', value: `@${showDetailModal.username}`, mono: true },
                  { label: 'Department', value: showDetailModal.department || '—' },
                  { label: 'Phone', value: showDetailModal.phone || '—' },
                  { label: 'Member Since', value: showDetailModal.createdAt ? new Date(showDetailModal.createdAt).toLocaleDateString() : '—' },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>
                    <p className={clsx('font-semibold text-slate-800', mono && 'font-mono')}>{value}</p>
                  </div>
                ))}
              </div>
              {showDetailModal.permissions?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Access Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {showDetailModal.permissions.map((p: string) => (
                      <span key={p} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-md">
                        {PERM_ICONS[p.charAt(0).toUpperCase() + p.slice(1)]} {p.charAt(0).toUpperCase() + p.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setShowDetailModal(null); setShowEditModal({ ...showDetailModal }) }} className="btn-secondary flex-1 text-sm">
                  <Pencil size={13} /> Edit
                </button>
                <button onClick={() => { setShowDetailModal(null); setShowResetModal(showDetailModal); setNewPassword('') }} className="btn-secondary flex-1 text-sm text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100">
                  <Key size={13} /> Reset Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}
