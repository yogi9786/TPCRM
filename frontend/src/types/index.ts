// =============================================
// types/index.ts — Shared TypeScript types
// =============================================

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Closed' | 'Lost'
export type LeadSource = 'Facebook Ads' | 'Instagram Ads' | 'WhatsApp' | 'Website' | 'Referral' | 'Walk-in' | 'Other'

export type ActivityType = 'note' | 'call' | 'whatsapp' | 'email' | 'meeting' | 'response'

export interface LeadActivity {
  id: string
  leadId: string
  type: ActivityType
  title: string
  description: string
  scheduledAt?: string      // ISO datetime string — for meetings
  durationMinutes?: number  // meeting duration
  location?: string         // physical or virtual

  isDone: boolean
  createdAt: string
  createdBy: string         // user uid
}

export interface Lead {
  id: string
  fullName: string
  email: string
  phone: string
  companyName?: string
  leadSource: LeadSource
  serviceInterested: string
  status: LeadStatus
  notes?: string
  userId: string
  assignedTo?: string
  createdAt: string
  updatedAt: string
  lastContactedAt?: string
  tags?: string[]
  value?: number
  whatsappOptIn?: boolean
}

export interface Message {
  id: string
  leadId: string
  phone: string
  direction: 'outbound' | 'inbound'
  body: string
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  twilioSid?: string
  createdAt: string
}

export interface Campaign {
  id: string
  name: string
  templateName: string
  message: string
  targetCount: number
  sentCount: number
  deliveredCount: number
  readCount: number
  failedCount: number
  status: 'draft' | 'running' | 'completed' | 'failed'
  userId: string
  createdAt: string
  scheduledAt?: string
  completedAt?: string
}

export interface MetaLead {
  id: string
  leadgenId: string
  formId: string
  pageId: string
  adId?: string
  adsetId?: string
  campaignId?: string
  fieldData: Record<string, string>
  importedToCRM: boolean
  crmLeadId?: string
  createdAt: string
}

export interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  role: 'admin' | 'agent'
  createdAt: string
}

export interface DashboardStats {
  totalLeads: number
  newLeads: number
  contacted: number
  qualified: number
  closed: number
  lost: number
  conversionRate: number
  messagesSent: number
  activeCampaigns: number
}

export interface WhatsAppTemplate {
  id: string
  name: string
  body: string
  variables: string[]
}
