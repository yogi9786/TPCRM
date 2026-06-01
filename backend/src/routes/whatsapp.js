// =============================================
// WhatsApp Routes — Twilio Integration
// POST /api/whatsapp/send         → Send a WhatsApp message
// POST /api/whatsapp/webhook      → Twilio status callback
// GET  /api/whatsapp/messages     → Get message history
// POST /api/whatsapp/bulk         → Bulk send campaign messages
// =============================================
const express = require('express')
const router = express.Router()
const twilio = require('twilio')
const { db } = require('../firebase')
const { verifyToken } = require('../middleware/auth')

// Initialize Twilio client
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token || sid.startsWith('AC') === false) {
    console.warn('⚠️  Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env')
    return null
  }
  return twilio(sid, token)
}

// ─────────────────────────────────────────────
// POST /api/whatsapp/send
// Send a single WhatsApp message via Twilio
// ─────────────────────────────────────────────
router.post('/send', verifyToken, async (req, res) => {
  const { phone, message } = req.body

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required' })
  }

  const client = getTwilioClient()
  
  if (!client) {
    // Demo mode — simulate success
    console.log(`[DEMO] Would send WhatsApp to ${phone}: "${message}"`)
    
    // Save to Firestore if available
    if (db) {
      await db.collection('messages').add({
        phone,
        body: message,
        direction: 'outbound',
        status: 'sent',
        twilioSid: `DEMO_${Date.now()}`,
        userId: req.user.uid,
        createdAt: new Date().toISOString(),
      })
    }

    return res.json({
      success: true,
      sid: `DEMO_${Date.now()}`,
      status: 'sent',
      message: 'Sent in demo mode (Twilio not configured)',
    })
  }

  try {
    // Normalize phone number to WhatsApp format
    let toNumber = phone.replace(/\s/g, '').replace(/[^\d+]/g, '')
    if (!toNumber.startsWith('+')) toNumber = '+' + toNumber
    const to = `whatsapp:${toNumber}`
    const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'

    const msg = await client.messages.create({
      from,
      to,
      body: message,
    })

    console.log(`✅ WhatsApp sent to ${to} | SID: ${msg.sid}`)

    // Log to Firestore
    if (db) {
      await db.collection('messages').add({
        phone: toNumber,
        body: message,
        direction: 'outbound',
        status: msg.status,
        twilioSid: msg.sid,
        userId: req.user.uid,
        createdAt: new Date().toISOString(),
      })
    }

    res.json({
      success: true,
      sid: msg.sid,
      status: msg.status,
      to: msg.to,
    })
  } catch (err) {
    console.error('❌ Twilio Error:', err.message)
    res.status(500).json({
      error: err.message,
      code: err.code,
    })
  }
})

// ─────────────────────────────────────────────
// POST /api/whatsapp/bulk
// Send messages to multiple leads (campaign)
// ─────────────────────────────────────────────
router.post('/bulk', verifyToken, async (req, res) => {
  const { phones, message, campaignId } = req.body

  if (!phones || !Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'phones array is required' })
  }
  if (!message) {
    return res.status(400).json({ error: 'message is required' })
  }

  const client = getTwilioClient()
  const results = []
  let sentCount = 0
  let failedCount = 0

  for (const phone of phones) {
    try {
      let toNumber = phone.replace(/\s/g, '').replace(/[^\d+]/g, '')
      if (!toNumber.startsWith('+')) toNumber = '+' + toNumber
      const to = `whatsapp:${toNumber}`
      const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'

      let sid, status
      if (client) {
        const msg = await client.messages.create({ from, to, body: message })
        sid = msg.sid
        status = msg.status
      } else {
        sid = `DEMO_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        status = 'sent'
      }

      // Log each message
      if (db) {
        await db.collection('messages').add({
          phone: toNumber,
          body: message,
          direction: 'outbound',
          status,
          twilioSid: sid,
          campaignId: campaignId || null,
          userId: req.user.uid,
          createdAt: new Date().toISOString(),
        })
      }

      sentCount++
      results.push({ phone: toNumber, sid, status, success: true })

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      failedCount++
      results.push({ phone, error: err.message, success: false })
    }
  }

  // Update campaign stats if provided
  if (campaignId && db) {
    await db.collection('campaigns').doc(campaignId).update({
      sentCount: sentCount,
      failedCount: failedCount,
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
  }

  res.json({
    success: true,
    total: phones.length,
    sent: sentCount,
    failed: failedCount,
    results,
  })
})

// ─────────────────────────────────────────────
// POST /api/whatsapp/webhook
// Twilio Status Callback Webhook
// ─────────────────────────────────────────────
router.post('/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  const { MessageSid, MessageStatus, To, From, Body } = req.body

  console.log(`📱 Twilio Webhook: ${MessageStatus} | ${MessageSid}`)

  // Update message status in Firestore
  if (db && MessageSid) {
    try {
      const snap = await db.collection('messages')
        .where('twilioSid', '==', MessageSid)
        .limit(1)
        .get()

      if (!snap.empty) {
        await snap.docs[0].ref.update({ status: MessageStatus })
      }

      // If it's an INBOUND message, save it
      if (!MessageSid.startsWith('SM') && Body) {
        await db.collection('messages').add({
          phone: From?.replace('whatsapp:', ''),
          body: Body,
          direction: 'inbound',
          status: 'received',
          twilioSid: MessageSid,
          createdAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Error updating message status:', err.message)
    }
  }

  // Twilio expects a 200 TwiML response
  res.type('text/xml')
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`)
})

// ─────────────────────────────────────────────
// GET /api/whatsapp/messages
// Get recent message history for the user
// ─────────────────────────────────────────────
router.get('/messages', verifyToken, async (req, res) => {
  if (!db) {
    return res.json({ messages: [] })
  }

  try {
    const snap = await db.collection('messages')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json({ messages, count: messages.length })
  } catch (err) {
    console.error('Error fetching messages:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
