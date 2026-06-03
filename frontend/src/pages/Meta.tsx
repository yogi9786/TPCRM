import { useState } from 'react'
import MainLayout from '../layouts/MainLayout'
import { Share2, Link, RefreshCw, Download, CheckCircle, Zap, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'

const API = 'https://tpcrm.onrender.com';

// Demo leads — in production these come from Meta webhook
const mockLeads = [
  { id: 'm1', name: 'Rahul Sharma',  email: 'rahul@example.com',  phone: '9876543210', form: 'Summer Campaign',  source: 'Facebook',  time: '2h ago',  imported: false },
  { id: 'm2', name: 'Priya Mehta',   email: 'priya@example.com',  phone: '9123456789', form: 'Product Launch',   source: 'Instagram', time: '4h ago',  imported: true  },
  { id: 'm3', name: 'Arun Singh',    email: 'arun@example.com',   phone: '9988776655', form: 'Summer Campaign',  source: 'Facebook',  time: '1d ago',  imported: false },
  { id: 'm4', name: 'Kavya Nair',    email: 'kavya@example.com',  phone: '9011223344', form: 'Brand Awareness',  source: 'Instagram', time: '1d ago',  imported: false },
]

export default function Meta() {
  const { currentUser } = useAuth()
  const [leads, setLeads]       = useState(mockLeads)
  const [importing, setImporting] = useState<string | null>(null)
  const [syncing, setSyncing]   = useState(false)
  const webhookUrl  = `${API}/meta/webhook`
  const verifyToken = 'tekhportal_verify_2024'

  // ── Import a Meta lead into CRM via backend REST API ──────────────────────
  async function importLead(lead: typeof mockLeads[0]) {
    if (!currentUser) {
      toast.error('You must be logged in to import leads')
      return
    }
    setImporting(lead.id)
    try {
      const token = await currentUser.getIdToken?.() ?? ''
      const res = await fetch(`${API}/leads/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName:          lead.name,
          email:             lead.email,
          phone:             lead.phone,
          leadSource:        lead.source === 'Facebook' ? 'Facebook Ads' : 'Instagram Ads',
          serviceInterested: 'Meta Ads',
          status:            'New',
          notes:             `Imported from Meta Ads form: ${lead.form}`,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (typeof err.detail === 'string' ? err.detail : err.detail?.message) ||
          `Server error ${res.status}`
        )
      }

      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, imported: true } : l))
      toast.success(`${lead.name} imported to CRM! ✅`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(null)
    }
  }

  async function syncAllLeads() {
    setSyncing(true)
    await new Promise(r => setTimeout(r, 1200))
    toast.success('Meta leads synced!')
    setSyncing(false)
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied!`)
  }

  function exportMetaCSV() {
    const header = ['Name', 'Email', 'Phone', 'Form', 'Source', 'Time', 'Imported']
    const rows = leads.map(l => [l.name, l.email, l.phone, l.form, l.source, l.time, l.imported ? 'Yes' : 'No'])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'meta_leads.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Meta leads exported!')
  }

  const totalImported = leads.filter(l => l.imported).length

  return (
    <MainLayout>
      <div className="space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Share2 className="text-blue-400" size={22} /> Meta Ads Integration
            </h1>
            <p className="page-subtitle">Capture &amp; import leads from Facebook and Instagram ad forms</p>
          </div>
          <button onClick={syncAllLeads} disabled={syncing} className="btn-primary self-start sm:self-auto">
            {syncing
              ? <><RefreshCw size={14} className="animate-spin" /> Syncing…</>
              : <><RefreshCw size={14} /> Sync Meta Leads</>
            }
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads',      value: leads.length,                                    color: 'text-blue-400',    border: 'border-blue-200' },
            { label: 'Imported to CRM',  value: totalImported,                                   color: 'text-emerald-400', border: 'border-emerald-500/20' },
            { label: 'Facebook',         value: leads.filter(l => l.source === 'Facebook').length, color: 'text-blue-700',   border: 'border-sky-500/20' },
            { label: 'Instagram',        value: leads.filter(l => l.source === 'Instagram').length, color: 'text-pink-400', border: 'border-pink-500/20' },
          ].map(({ label, value, color, border }) => (
            <div key={label} className={`glass-card p-4 border ${border}`}>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Webhook config */}
        <div className="glass-card p-5 border border-blue-200">
          <h2 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" /> Meta Webhook Setup
          </h2>
          <p className="text-xs text-slate-500 mb-4">Add these to your Meta App → Webhooks → Lead Ads subscription</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Callback URL</label>
              <div className="flex gap-2">
                <input readOnly value={webhookUrl} className="input-field text-xs font-mono" />
                <button onClick={() => copyText(webhookUrl, 'URL')} className="btn-secondary flex-shrink-0 px-3">
                  <Copy size={13} />
                </button>
              </div>
            </div>
            <div>
              <label className="label">Verify Token</label>
              <div className="flex gap-2">
                <input readOnly value={verifyToken} className="input-field text-xs font-mono" />
                <button onClick={() => copyText(verifyToken, 'Token')} className="btn-secondary flex-shrink-0 px-3">
                  <Copy size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Leads table */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Meta Ad Leads</h2>
              <p className="text-xs text-slate-500 mt-0.5">{leads.length - totalImported} pending import</p>
            </div>
            <button onClick={exportMetaCSV} className="btn-secondary text-xs py-1.5">
              <Download size={13} /> Export
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  {['Name', 'Email', 'Phone', 'Form', 'Source', 'Time', 'Action'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-pink-500/20 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                          {lead.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-900">{lead.name}</span>
                      </div>
                    </td>
                    <td className="table-cell text-slate-500">{lead.email}</td>
                    <td className="table-cell text-blue-400">{lead.phone}</td>
                    <td className="table-cell text-xs text-slate-500">{lead.form}</td>
                    <td className="table-cell">
                      <span className={clsx('badge',
                        lead.source === 'Facebook' ? 'bg-blue-500/15 text-blue-300' : 'bg-pink-500/15 text-pink-300'
                      )}>
                        {lead.source}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-slate-500">{lead.time}</td>
                    <td className="table-cell">
                      {lead.imported ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircle size={13} /> Imported
                        </span>
                      ) : (
                        <button
                          onClick={() => importLead(lead)}
                          disabled={importing === lead.id}
                          className="btn-primary py-1.5 px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {importing === lead.id
                            ? <><RefreshCw size={12} className="animate-spin" /> Importing…</>
                            : <><Download size={12} /> Import to CRM</>
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </MainLayout>
  )
}
