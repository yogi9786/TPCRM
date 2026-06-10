
const express = require('express')
const router = express.Router()
const { db } = require('../firebase')
const { verifyToken } = require('../middleware/auth')
const twilio = require('twilio')

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token || !sid.startsWith('AC')) return null
  return twilio(sid, token)
}


router.get('/', verifyToken, async (req, res) => {
  if (!db) return res.json({ campaigns: [] })

  try {
    const snap = await db.collection('campaigns')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const campaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json({ campaigns, count: campaigns.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { name, message, targetStatus } = req.body
  if (!name || !message) return res.status(400).json({ error: 'name and message are required' })

  try {
    const docRef = await db.collection('campaigns').add({
      name,
      message,
      targetStatus: targetStatus || 'All',
      status: 'draft',
      targetCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      userId: req.user.uid,
      createdAt: new Date().toISOString(),
    })
    res.status(201).json({ success: true, id: docRef.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


router.patch('/:id', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const docRef = db.collection('campaigns').doc(req.params.id)
    const doc = await docRef.get()
    if (!doc.exists || doc.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    const allowed = ['name', 'message', 'status', 'targetStatus']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }

    await docRef.update(updates)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


router.delete('/:id', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const docRef = db.collection('campaigns').doc(req.params.id)
    const doc = await docRef.get()
    if (!doc.exists || doc.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Campaign not found' })
    }
    await docRef.delete()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


router.post('/:id/launch', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const campaignDoc = await db.collection('campaigns').doc(req.params.id).get()
    if (!campaignDoc.exists || campaignDoc.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    const campaign = campaignDoc.data()


    let leadsQuery = db.collection('leads').where('userId', '==', req.user.uid)
    if (campaign.targetStatus && campaign.targetStatus !== 'All') {
      leadsQuery = leadsQuery.where('status', '==', campaign.targetStatus)
    }
    const leadsSnap = await leadsQuery.get()
    const leads = leadsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No leads match the target criteria' })
    }

    // Update campaign to running
    await db.collection('campaigns').doc(req.params.id).update({
      status: 'running',
      targetCount: leads.length,
      startedAt: new Date().toISOString(),
    })

    const client = getTwilioClient()
    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'
    let sentCount = 0
    let failedCount = 0

    // Send messages (with basic personalization)
    for (const lead of leads) {
      try {
        const personalizedMsg = campaign.message
          .replace(/\{\{name\}\}/gi, lead.fullName || 'there')
          .replace(/\{\{service\}\}/gi, lead.serviceInterested || 'our services')

        let toNumber = (lead.phone || '').replace(/\s/g, '').replace(/[^\d+]/g, '')
        if (!toNumber.startsWith('+')) toNumber = '+' + toNumber
        const to = `whatsapp:${toNumber}`

        if (client && toNumber.length >= 10) {
          await client.messages.create({ from, to, body: personalizedMsg })
        }

        // Log message
        await db.collection('messages').add({
          phone: toNumber,
          body: personalizedMsg,
          direction: 'outbound',
          status: client ? 'sent' : 'demo',
          campaignId: req.params.id,
          leadId: lead.id,
          userId: req.user.uid,
          createdAt: new Date().toISOString(),
        })

        sentCount++
        await new Promise(r => setTimeout(r, 150)) // Rate limit
      } catch (err) {
        console.error(`Failed to send to ${lead.phone}:`, err.message)
        failedCount++
      }
    }

    // Mark campaign completed
    await db.collection('campaigns').doc(req.params.id).update({
      status: 'completed',
      sentCount,
      failedCount,
      completedAt: new Date().toISOString(),
    })

    res.json({
      success: true,
      targetCount: leads.length,
      sentCount,
      failedCount,
    })
  } catch (err) {
    console.error('Campaign launch error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
