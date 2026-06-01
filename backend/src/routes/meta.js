// =============================================
// Meta Routes — Facebook / Instagram Lead Ads
// GET  /api/meta/webhook           → Webhook verification
// POST /api/meta/webhook           → Receive lead events
// GET  /api/meta/leads             → Fetch form leads from Meta API
// POST /api/meta/leads/:id/import  → Import Meta lead to CRM
// =============================================
const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const axios = require('axios')
const { db } = require('../firebase')
const { verifyToken } = require('../middleware/auth')

// ─────────────────────────────────────────────
// GET /api/meta/webhook
// Meta webhook verification (one-time setup)
// ─────────────────────────────────────────────
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'tekhportal_verify_2024'

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Meta Webhook verified!')
    return res.status(200).send(challenge)
  }

  console.warn('⚠️  Meta Webhook verification failed. Check verify token.')
  res.status(403).json({ error: 'Verification failed' })
})

// ─────────────────────────────────────────────
// POST /api/meta/webhook
// Receive new lead events from Meta Lead Ads
// ─────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  // Verify signature (security)
  const signature = req.headers['x-hub-signature-256']
  const appSecret = process.env.META_APP_SECRET

  if (appSecret && signature) {
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(req.body) // raw body
      .digest('hex')

    if (signature !== expectedSig) {
      console.warn('⚠️  Invalid Meta webhook signature')
      return res.status(403).json({ error: 'Invalid signature' })
    }
  }

  // Parse body (was raw Buffer)
  let body
  try {
    body = JSON.parse(req.body.toString())
  } catch {
    body = req.body
  }

  console.log('📨 Meta Webhook received:', JSON.stringify(body, null, 2))

  // Process lead gen events
  if (body.object === 'page' && body.entry) {
    for (const entry of body.entry) {
      for (const change of (entry.changes || [])) {
        if (change.field === 'leadgen') {
          const leadgenId = change.value?.leadgen_id
          const formId = change.value?.form_id
          const pageId = change.value?.page_id

          if (leadgenId && db) {
            try {
              // Fetch full lead data from Meta Graph API
              const leadData = await fetchMetaLead(leadgenId)

              // Save to Firestore
              await db.collection('metaLeads').add({
                leadgenId,
                formId,
                pageId,
                adId: change.value?.ad_id,
                fieldData: leadData?.field_data?.reduce((acc, f) => {
                  acc[f.name] = f.values?.[0] || ''
                  return acc
                }, {}) || {},
                importedToCRM: false,
                createdAt: new Date().toISOString(),
              })

              console.log(`✅ Meta lead ${leadgenId} saved to Firestore`)
            } catch (err) {
              console.error(`❌ Error processing Meta lead: ${err.message}`)
            }
          }
        }
      }
    }
  }

  res.status(200).json({ success: true })
})

// ─────────────────────────────────────────────
// Helper: Fetch lead data from Meta Graph API
// ─────────────────────────────────────────────
async function fetchMetaLead(leadgenId) {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  if (!token || token === 'EAAxxxxxxxx') {
    console.warn('⚠️  META_PAGE_ACCESS_TOKEN not configured')
    return null
  }
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v20.0/${leadgenId}`,
      { params: { access_token: token } }
    )
    return data
  } catch (err) {
    console.error('Meta Graph API error:', err.response?.data || err.message)
    return null
  }
}

// ─────────────────────────────────────────────
// GET /api/meta/leads
// Fetch leads from Meta Page Lead Forms
// ─────────────────────────────────────────────
router.get('/leads', verifyToken, async (req, res) => {
  const token = process.env.META_PAGE_ACCESS_TOKEN
  const pageId = process.env.META_PAGE_ID

  if (!token || !pageId || token === 'EAAxxxxxxxx') {
    // Return mock data in dev mode
    return res.json({
      leads: [
        { id: 'm1', name: 'Rahul Sharma', email: 'rahul@example.com', phone: '9876543210', form: 'Summer Campaign', source: 'Facebook', createdAt: new Date().toISOString(), imported: false },
        { id: 'm2', name: 'Priya Mehta', email: 'priya@example.com', phone: '9123456789', form: 'Product Launch', source: 'Instagram', createdAt: new Date().toISOString(), imported: false },
      ],
      note: 'Demo mode — configure META_PAGE_ACCESS_TOKEN in .env',
    })
  }

  try {
    // Get lead forms for this page
    const formsRes = await axios.get(
      `https://graph.facebook.com/v20.0/${pageId}/leadgen_forms`,
      { params: { access_token: token, fields: 'id,name,leads_count' } }
    )

    const forms = formsRes.data?.data || []
    const allLeads = []

    // Fetch leads from each form (limit to first 3 forms)
    for (const form of forms.slice(0, 3)) {
      const leadsRes = await axios.get(
        `https://graph.facebook.com/v20.0/${form.id}/leads`,
        { params: { access_token: token, fields: 'id,created_time,field_data,ad_id,campaign_id' } }
      )
      const leads = leadsRes.data?.data || []
      for (const lead of leads) {
        const fields = {}
        for (const f of (lead.field_data || [])) {
          fields[f.name] = f.values?.[0] || ''
        }
        allLeads.push({
          id: lead.id,
          name: fields.full_name || fields.name || 'Unknown',
          email: fields.email || '',
          phone: fields.phone_number || fields.phone || '',
          form: form.name,
          source: 'Facebook',
          createdAt: lead.created_time,
          imported: false,
        })
      }
    }

    res.json({ leads: allLeads, count: allLeads.length })
  } catch (err) {
    console.error('Meta Graph API error:', err.response?.data || err.message)
    res.status(500).json({ error: 'Failed to fetch Meta leads', details: err.response?.data })
  }
})

// ─────────────────────────────────────────────
// POST /api/meta/leads/:id/import
// Import a single Meta lead into CRM (Firestore)
// ─────────────────────────────────────────────
router.post('/leads/:id/import', verifyToken, async (req, res) => {
  const { id } = req.params
  const { name, email, phone, form, source } = req.body

  if (!db) {
    return res.status(503).json({ error: 'Database not configured' })
  }

  try {
    const docRef = await db.collection('leads').add({
      fullName: name || 'Unknown',
      email: email || '',
      phone: phone || '',
      leadSource: source === 'Instagram' ? 'Instagram Ads' : 'Facebook Ads',
      serviceInterested: 'Meta Ads',
      status: 'New',
      notes: `Imported from Meta Lead Form: ${form}`,
      userId: req.user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Mark as imported in metaLeads collection
    const metaSnap = await db.collection('metaLeads')
      .where('leadgenId', '==', id)
      .limit(1)
      .get()

    if (!metaSnap.empty) {
      await metaSnap.docs[0].ref.update({
        importedToCRM: true,
        crmLeadId: docRef.id,
      })
    }

    res.json({ success: true, crmLeadId: docRef.id })
  } catch (err) {
    console.error('Import error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
