// =============================================
// Auth Middleware — Verify Firebase ID Token
// =============================================
const { auth } = require('../firebase')

/**
 * Verifies the Bearer token in the Authorization header.
 * Attaches decoded user to req.user.
 * If Firebase Admin isn't configured, falls through in dev mode.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In dev mode without Firebase creds, allow through
    if (!auth) {
      req.user = { uid: 'dev-user', email: 'dev@tekhportal.com' }
      return next()
    }
    return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' })
  }

  const token = authHeader.split('Bearer ')[1]

  try {
    if (!auth) {
      // Dev mode without Firebase — mock user
      req.user = { uid: 'dev-user', email: 'dev@tekhportal.com' }
      return next()
    }
    const decoded = await auth.verifyIdToken(token)
    req.user = decoded
    next()
  } catch (err) {
    console.error('Token verification failed:', err.message)
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
  }
}

module.exports = { verifyToken }
