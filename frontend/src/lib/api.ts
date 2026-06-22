/**
 * Central API base URL.
 * - In development: uses VITE_API_URL from .env (http://localhost:8000)
 * - In production build: uses VITE_API_URL from Netlify env vars, OR falls back to Render
 *
 * Set VITE_API_URL=https://tpcrm.onrender.com on Netlify to ensure production always hits Render.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'https://tpcrm.onrender.com'
