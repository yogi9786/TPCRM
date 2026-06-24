import { useState, useEffect } from 'react'
import MainLayout from '../layouts/MainLayout'
import PageHeader from '../components/PageHeader'
import { Settings as SettingsIcon, Save, Building, Sliders, Bell, Plug, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Settings() {
  const [tab, setTab] = useState<'profile' | 'crm_preferences' | 'integrations' | 'notifications'>('profile')
  const [saving, setSaving] = useState(false)

  // Profile State
  const [profile, setProfile] = useState({
    companyName: 'TekhPortal',
    adminEmail: 'admin@tekhportal.com',
    timezone: 'Asia/Kolkata'
  })

  // CRM Preferences State
  const [leadStatuses, setLeadStatuses] = useState(['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'])
  const [newStatus, setNewStatus] = useState('')

  const [leadSources, setLeadSources] = useState(['Facebook Ads', 'Instagram Ads', 'Google Ads', 'Organic', 'Referral'])
  const [newSource, setNewSource] = useState('')

  const [tags, setTags] = useState(['VIP', 'Urgent', 'Follow-up Needed', 'High Value'])
  const [newTag, setNewTag] = useState('')

  // Notifications State
  const [notifConfig, setNotifConfig] = useState({
    newLeadAlert: true,
    whatsappInbound: true,
    campaignComplete: true,
    dailyDigest: false,
    emailAlerts: 'admin@tekhportal.com',
  })

  // Load from local storage on mount
  useEffect(() => {
    const savedPrefs = localStorage.getItem('crmSettings')
    if (savedPrefs) {
      const parsed = JSON.parse(savedPrefs)
      if (parsed.profile) setProfile(parsed.profile)
      if (parsed.leadStatuses) setLeadStatuses(parsed.leadStatuses)
      if (parsed.leadSources) setLeadSources(parsed.leadSources)
      if (parsed.tags) setTags(parsed.tags)
      if (parsed.notifConfig) setNotifConfig(parsed.notifConfig)
    }
  }, [])

  async function saveSettings() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    
    // Save to local storage
    localStorage.setItem('crmSettings', JSON.stringify({
      profile,
      leadStatuses,
      leadSources,
      tags,
      notifConfig
    }))

    setSaving(false)
    toast.success('CRM Settings saved successfully!')
  }

  const tabs = [
    { id: 'profile', label: 'General Profile', icon: Building },
    { id: 'crm_preferences', label: 'CRM Preferences', icon: Sliders },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ]

  const addItem = (list: string[], setList: (val: string[]) => void, item: string, setItem: (val: string) => void) => {
    if (item.trim() && !list.includes(item.trim())) {
      setList([...list, item.trim()])
      setItem('')
    }
  }

  const removeItem = (list: string[], setList: (val: string[]) => void, index: number) => {
    const newList = [...list]
    newList.splice(index, 1)
    setList(newList)
  }

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        <PageHeader
          title="CRM Settings"
          subtitle="Configure your CRM preferences, fields, and organization details"
          icon={<SettingsIcon size={20} />}
          badge="Configuration"
          actions={
            <button onClick={saveSettings} disabled={saving} className="btn-accent">
              {saving ? (
                <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
              ) : (
                <><Save size={15} /> Save Settings</>
              )}
            </button>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-5">
          {/* Sidebar */}
          <div className="card p-3 h-fit space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as typeof tab)}
                className={clsx(
                  'flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  tab === id
                    ? 'text-white'
                    : 'hover:bg-[#f0f0f9]'
                )}
                style={tab === id ? {
                  background: 'linear-gradient(135deg, #100F88, #1a19c0)',
                  color: 'white',
                  boxShadow: '0 2px 10px rgba(16,15,136,0.30)',
                } : { color: '#5a5898' }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="glass-card p-6 space-y-6">
            
            {/* General Profile Tab */}
            {tab === 'profile' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
                    <Building size={18} className="text-indigo-500" /> Organization Profile
                  </h2>
                  <p className="text-sm text-slate-500 mb-4">
                    Manage your company details and global CRM defaults.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
                    <div>
                      <label className="label">Company Name</label>
                      <input
                        type="text"
                        className="input-field"
                        value={profile.companyName}
                        onChange={(e) => setProfile({...profile, companyName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="label">Admin Email</label>
                      <input
                        type="email"
                        className="input-field"
                        value={profile.adminEmail}
                        onChange={(e) => setProfile({...profile, adminEmail: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="label">Default Timezone</label>
                      <select 
                        className="input-field bg-white"
                        value={profile.timezone}
                        onChange={(e) => setProfile({...profile, timezone: e.target.value})}
                      >
                        <option value="Asia/Kolkata">India Standard Time (IST)</option>
                        <option value="UTC">UTC</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CRM Preferences Tab */}
            {tab === 'crm_preferences' && (
              <div className="space-y-8 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
                    <Sliders size={18} className="text-fuchsia-500" /> CRM Preferences
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">
                    Customize the dropdown options and tags available when adding or editing leads and clients.
                  </p>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Lead Statuses */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm">
                      <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wider">Lead Statuses</h3>
                      <div className="space-y-2 mb-4">
                        {leadStatuses.map((status, index) => (
                          <div key={index} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm">
                            <span className="font-medium text-slate-700">{status}</span>
                            <button onClick={() => removeItem(leadStatuses, setLeadStatuses, index)} className="text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Add new status..." 
                          className="input-field py-1.5 text-sm"
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addItem(leadStatuses, setLeadStatuses, newStatus, setNewStatus)}
                        />
                        <button onClick={() => addItem(leadStatuses, setLeadStatuses, newStatus, setNewStatus)} className="btn-primary py-1.5 px-3">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Lead Sources */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm">
                      <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wider">Lead Sources</h3>
                      <div className="space-y-2 mb-4">
                        {leadSources.map((source, index) => (
                          <div key={index} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm">
                            <span className="font-medium text-slate-700">{source}</span>
                            <button onClick={() => removeItem(leadSources, setLeadSources, index)} className="text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Add new source..." 
                          className="input-field py-1.5 text-sm"
                          value={newSource}
                          onChange={(e) => setNewSource(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addItem(leadSources, setLeadSources, newSource, setNewSource)}
                        />
                        <button onClick={() => addItem(leadSources, setLeadSources, newSource, setNewSource)} className="btn-primary py-1.5 px-3">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Global Tags */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-sm lg:col-span-2">
                      <h3 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wider">Global Tags</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {tags.map((tag, index) => (
                          <div key={index} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium">
                            <span>{tag}</span>
                            <button onClick={() => removeItem(tags, setTags, index)} className="text-indigo-400 hover:text-indigo-600 transition-colors bg-indigo-100 rounded-full p-0.5">
                              <XCircle size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 max-w-sm">
                        <input 
                          type="text" 
                          placeholder="Add new tag..." 
                          className="input-field py-1.5 text-sm"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addItem(tags, setTags, newTag, setNewTag)}
                        />
                        <button onClick={() => addItem(tags, setTags, newTag, setNewTag)} className="btn-primary py-1.5 px-3">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* Integrations Tab */}
            {tab === 'integrations' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
                    <Plug size={18} className="text-teal-500" /> Connected Integrations
                  </h2>
                  <p className="text-sm text-slate-500 mb-6">
                    View the status of your 3rd party connections. API Keys are securely managed via the backend `.env` file.
                  </p>
                  
                  <div className="space-y-4 max-w-3xl">
                    <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                          M
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800">Meta (Facebook & Instagram)</h4>
                          <p className="text-xs text-slate-500">Used for Lead Ads integration and Meta Campaigns.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-sm font-medium">
                        <CheckCircle size={14} /> Connected
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl">
                          W
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800">Twilio (WhatsApp)</h4>
                          <p className="text-xs text-slate-500">Used for automated WhatsApp messaging and broadcasts.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-sm font-medium">
                        <CheckCircle size={14} /> Connected
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl">
                          B
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800">Brevo</h4>
                          <p className="text-xs text-slate-500">Used for transactional emails and email blasts.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-sm font-medium">
                        <CheckCircle size={14} /> Connected
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {tab === 'notifications' && (
              <div className="space-y-6 animate-fade-in">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Bell size={18} className="text-amber-400" /> Notification Preferences
                </h2>
                <div className="space-y-3 max-w-2xl">
                  {[
                    { key: 'newLeadAlert', label: 'New Lead Alert', desc: 'Notify when a new lead is added to CRM' },
                    { key: 'whatsappInbound', label: 'WhatsApp Inbound', desc: 'Alert on new incoming WhatsApp message' },
                    { key: 'campaignComplete', label: 'Campaign Complete', desc: 'Notify when a broadcast campaign finishes' },
                    { key: 'dailyDigest', label: 'Daily Digest', desc: 'Email summary of daily CRM activity' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifConfig(c => ({ ...c, [key]: !c[key as keyof typeof c] }))}
                        className={clsx(
                          'relative w-11 h-6 rounded-full transition-colors duration-200',
                          (notifConfig as any)[key] ? 'bg-indigo-600' : 'bg-slate-300'
                        )}
                      >
                        <div className={clsx(
                          'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                          (notifConfig as any)[key] ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                  ))}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <label className="label">Alert Email Address</label>
                    <input
                      className="input-field max-w-sm"
                      type="email"
                      placeholder="admin@tekhportal.com"
                      value={notifConfig.emailAlerts}
                      onChange={e => setNotifConfig(c => ({ ...c, emailAlerts: e.target.value }))}
                    />
                    <p className="text-xs text-slate-500 mt-2">All notifications will be sent to this email address.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t mt-8" style={{ borderColor: '#e4e4f0' }}>
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                ) : (
                  <><Save size={15} /> Save All CRM Settings</>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </MainLayout>
  )
}
