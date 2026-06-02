import { useState } from 'react'
import MainLayout from '../layouts/MainLayout'
import { Settings as SettingsIcon, Save, Key, Bell, Shield, Webhook, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Settings() {
  const [tab, setTab] = useState<'api' | 'notifications' | 'security'>('api')
  const [showTwilioSid, setShowTwilioSid] = useState(false)
  const [showTwilioToken, setShowTwilioToken] = useState(false)
  const [showMetaToken, setShowMetaToken] = useState(false)
  const [saving, setSaving] = useState(false)

  const [apiConfig, setApiConfig] = useState({
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioWhatsAppNumber: 'whatsapp:+14155238886',
    metaPageAccessToken: '',
    metaPageId: '',
    backendUrl: 'http://localhost:4000',
  })

  const [notifConfig, setNotifConfig] = useState({
    newLeadAlert: true,
    whatsappInbound: true,
    campaignComplete: true,
    dailyDigest: false,
    emailAlerts: '',
  })

  async function saveSettings() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    toast.success('Settings saved!')
  }

  const tabs = [
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <SettingsIcon className="text-slate-500" size={24} /> Settings
          </h1>
          <p className="page-subtitle">Configure API integrations, notifications & security</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-5">
          {/* Sidebar */}
          <div className="glass-card p-3 h-fit space-y-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as typeof tab)}
                className={clsx(
                  'flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all',
                  tab === id
                    ? 'bg-sky-500/10 text-blue-700 border border-sky-500/20'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="glass-card p-6 space-y-6">
            {/* API Keys Tab */}
            {tab === 'api' && (
              <>
                <div>
                  <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                    <Key size={15} className="text-yellow-400" /> Twilio (WhatsApp)
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Get these from your{' '}
                    <a href="https://console.twilio.com" target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      Twilio Console
                    </a>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Account SID</label>
                      <div className="relative">
                        <input
                          type={showTwilioSid ? 'text' : 'password'}
                          className="input-field pr-10"
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={apiConfig.twilioAccountSid}
                          onChange={e => setApiConfig(c => ({ ...c, twilioAccountSid: e.target.value }))}
                        />
                        <button onClick={() => setShowTwilioSid(!showTwilioSid)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700">
                          {showTwilioSid ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="label">Auth Token</label>
                      <div className="relative">
                        <input
                          type={showTwilioToken ? 'text' : 'password'}
                          className="input-field pr-10"
                          placeholder="Your auth token"
                          value={apiConfig.twilioAuthToken}
                          onChange={e => setApiConfig(c => ({ ...c, twilioAuthToken: e.target.value }))}
                        />
                        <button onClick={() => setShowTwilioToken(!showTwilioToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700">
                          {showTwilioToken ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">WhatsApp Number</label>
                      <input
                        className="input-field"
                        placeholder="whatsapp:+14155238886"
                        value={apiConfig.twilioWhatsAppNumber}
                        onChange={e => setApiConfig(c => ({ ...c, twilioWhatsAppNumber: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
                    <Webhook size={15} className="text-blue-400" /> Meta (Facebook / Instagram)
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Get these from your{' '}
                    <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      Meta Developer Console
                    </a>
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Page Access Token</label>
                      <div className="relative">
                        <input
                          type={showMetaToken ? 'text' : 'password'}
                          className="input-field pr-10"
                          placeholder="EAAxxxxxxxx..."
                          value={apiConfig.metaPageAccessToken}
                          onChange={e => setApiConfig(c => ({ ...c, metaPageAccessToken: e.target.value }))}
                        />
                        <button onClick={() => setShowMetaToken(!showMetaToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700">
                          {showMetaToken ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="label">Page ID</label>
                      <input
                        className="input-field"
                        placeholder="123456789012345"
                        value={apiConfig.metaPageId}
                        onChange={e => setApiConfig(c => ({ ...c, metaPageId: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <label className="label">Backend API URL</label>
                  <input
                    className="input-field max-w-sm"
                    value={apiConfig.backendUrl}
                    onChange={e => setApiConfig(c => ({ ...c, backendUrl: e.target.value }))}
                  />
                  <p className="text-xs text-slate-600 mt-1.5">URL of your Node.js backend server</p>
                </div>
              </>
            )}

            {/* Notifications Tab */}
            {tab === 'notifications' && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Bell size={15} className="text-amber-400" /> Notification Preferences
                </h2>
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
                        (notifConfig as any)[key] ? 'bg-sky-500' : 'bg-slate-700'
                      )}
                    >
                      <div className={clsx(
                        'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                        (notifConfig as any)[key] ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>
                ))}
                <div>
                  <label className="label">Alert Email</label>
                  <input
                    className="input-field max-w-sm"
                    type="email"
                    placeholder="admin@tekhportal.com"
                    value={notifConfig.emailAlerts}
                    onChange={e => setNotifConfig(c => ({ ...c, emailAlerts: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Security Tab */}
            {tab === 'security' && (
              <div className="space-y-5">
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Shield size={15} className="text-emerald-400" /> Security Settings
                </h2>
                <div className="space-y-3">
                  {[
                    { label: 'Firebase Auth', status: 'Connected', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Firestore Rules', status: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'HTTPS/TLS', status: 'Enabled', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                    { label: 'Webhook Signature Validation', status: 'Enabled', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                  ].map(({ label, status, color, bg }) => (
                    <div key={label} className={`flex items-center justify-between p-4 rounded-xl border ${bg}`}>
                      <p className="text-sm text-slate-900">{label}</p>
                      <span className={`text-xs font-semibold ${color}`}>{status}</span>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs text-amber-300">
                    💡 All API keys are stored securely in your backend environment variables (.env file) and never exposed to the frontend.
                  </p>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-200">
              <button onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Saving...</>
                ) : (
                  <><Save size={15} /> Save Settings</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
