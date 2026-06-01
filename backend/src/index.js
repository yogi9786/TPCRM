// =============================================
// TekhPortal Backend — Main Entry Point
// Express + Firebase Admin + Twilio + Meta API
// =============================================
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

// Routes
const whatsappRoutes = require('./routes/whatsapp')
const metaRoutes = require('./routes/meta')
const leadsRoutes = require('./routes/leads')
const campaignsRoutes = require('./routes/campaigns')

const app = express()
const PORT = process.env.PORT || 4000

// ── Security Middleware ─────────────────────────────
app.use(helmet())
app.use(morgan('dev'))

// ── Rate Limiting ──────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests. Please try again later.' },
})
app.use(limiter)

// ── CORS ───────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ── Body Parsers ───────────────────────────────────
// Raw body for Meta webhook signature verification
app.use('/api/meta/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Health Check ───────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TekhPortal CRM API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  })
})

// ── API Routes ─────────────────────────────────────
app.use('/api/whatsapp', whatsappRoutes)
app.use('/api/meta', metaRoutes)
app.use('/api/leads', leadsRoutes)
app.use('/api/campaigns', campaignsRoutes)

// ── 404 Handler ────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global Error Handler ───────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Start Server ───────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║      TekhPortal CRM Backend           ║
  ║      Server running on :${PORT}          ║
  ╚═══════════════════════════════════════╝
  `)
  console.log(`  ✅ Health:    http://localhost:${PORT}/health`)
  console.log(`  ✅ WhatsApp:  http://localhost:${PORT}/api/whatsapp`)
  console.log(`  ✅ Meta:      http://localhost:${PORT}/api/meta`)
  console.log(`  ✅ Leads:     http://localhost:${PORT}/api/leads`)
  console.log(`  ✅ Campaigns: http://localhost:${PORT}/api/campaigns\n`)
})

module.exports = app
