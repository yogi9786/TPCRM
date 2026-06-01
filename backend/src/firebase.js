// =============================================
// Firebase Admin SDK — Singleton
// =============================================
const admin = require('firebase-admin')

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    })
    console.log('✅ Firebase Admin SDK initialized')
  } catch (err) {
    console.warn('⚠️  Firebase Admin: Using mock mode (no credentials). Set FIREBASE_* env vars.')
  }
}

const db = admin.apps.length ? admin.firestore() : null
const auth = admin.apps.length ? admin.auth() : null

module.exports = { admin, db, auth }
