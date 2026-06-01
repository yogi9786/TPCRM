// =============================================
// Leads Routes — Firestore CRUD
// GET    /api/leads          → List all leads for user
// POST   /api/leads          → Create a new lead
// GET    /api/leads/:id      → Get a single lead
// PATCH  /api/leads/:id      → Update a lead
// DELETE /api/leads/:id      → Delete a lead
// GET    /api/leads/stats    → Get lead statistics
// =============================================
const express = require('express')
const router = express.Router()
const { db } = require('../firebase')
const { verifyToken } = require('../middleware/auth')

// ─────────────────────────────────────────────
// GET /api/leads
// ─────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  if (!db) return res.json({ leads: [] })

  try {
    const { status, source, search, limit = 100 } = req.query

    let query = db.collection('leads').where('userId', '==', req.user.uid)

    if (status && status !== 'All') {
      query = query.where('status', '==', status)
    }
    if (source) {
      query = query.where('leadSource', '==', source)
    }

    const snap = await query.orderBy('createdAt', 'desc').limit(Number(limit)).get()
    let leads = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Search filter (client-side since Firestore doesn't support full-text)
    if (search) {
      const q = search.toLowerCase()
      leads = leads.filter(l =>
        l.fullName?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.companyName?.toLowerCase().includes(q)
      )
    }

    res.json({ leads, count: leads.length })
  } catch (err) {
    console.error('Error fetching leads:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// GET /api/leads/stats
// ─────────────────────────────────────────────
router.get('/stats', verifyToken, async (req, res) => {
  if (!db) {
    return res.json({ total: 0, new: 0, contacted: 0, qualified: 0, closed: 0, lost: 0 })
  }

  try {
    const snap = await db.collection('leads')
      .where('userId', '==', req.user.uid)
      .get()

    const leads = snap.docs.map(d => d.data())
    const stats = {
      total: leads.length,
      new: leads.filter(l => l.status === 'New').length,
      contacted: leads.filter(l => l.status === 'Contacted').length,
      qualified: leads.filter(l => l.status === 'Qualified').length,
      closed: leads.filter(l => l.status === 'Closed').length,
      lost: leads.filter(l => l.status === 'Lost').length,
    }
    stats.conversionRate = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0

    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// POST /api/leads
// ─────────────────────────────────────────────
router.post('/', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  const { fullName, phone, email, companyName, leadSource, serviceInterested, status, notes } = req.body

  if (!fullName || !phone) {
    return res.status(400).json({ error: 'fullName and phone are required' })
  }

  try {
    const docRef = await db.collection('leads').add({
      fullName,
      phone,
      email: email || '',
      companyName: companyName || '',
      leadSource: leadSource || 'Other',
      serviceInterested: serviceInterested || '',
      status: status || 'New',
      notes: notes || '',
      userId: req.user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    res.status(201).json({ success: true, id: docRef.id })
  } catch (err) {
    console.error('Error creating lead:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// GET /api/leads/:id
// ─────────────────────────────────────────────
router.get('/:id', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const doc = await db.collection('leads').doc(req.params.id).get()
    if (!doc.exists || doc.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Lead not found' })
    }
    res.json({ id: doc.id, ...doc.data() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// PATCH /api/leads/:id
// ─────────────────────────────────────────────
router.patch('/:id', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const docRef = db.collection('leads').doc(req.params.id)
    const doc = await docRef.get()

    if (!doc.exists || doc.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    const allowed = ['fullName', 'phone', 'email', 'companyName', 'leadSource', 'serviceInterested', 'status', 'notes', 'tags', 'value']
    const updates = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    updates.updatedAt = new Date().toISOString()

    await docRef.update(updates)
    res.json({ success: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─────────────────────────────────────────────
// DELETE /api/leads/:id
// ─────────────────────────────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  if (!db) return res.status(503).json({ error: 'Database not configured' })

  try {
    const docRef = db.collection('leads').doc(req.params.id)
    const doc = await docRef.get()

    if (!doc.exists || doc.data()?.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Lead not found' })
    }

    await docRef.delete()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
