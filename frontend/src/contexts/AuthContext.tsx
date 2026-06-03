import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as FirebaseUser, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth'
import { auth } from '../firebase'

interface AuthContextType {
  currentUser: any
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if there is a local session active
    const storedUser = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    if (storedUser && storedToken) {
      try {
        const userObj = JSON.parse(storedUser)
        setCurrentUser({
          ...userObj,
          getIdToken: async () => storedToken
        })
        setLoading(false)
        return
      } catch (e) {
        localStorage.removeItem('user')
        localStorage.removeItem('token')
      }
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Firebase is authenticated, but we must override getIdToken to return the FastAPI backend token
        // since our backend requires the FastAPI JWT, not the Firebase ID token!
        setCurrentUser(Object.assign(user, {
          getIdToken: async () => localStorage.getItem('token') || ''
        }))
      } else {
        // Only clear if there's no local token
        if (!localStorage.getItem('token')) {
          setCurrentUser(null)
        }
      }
      setLoading(false)
    })
    return unsub
  }, [])

  async function login(email: string, password: string) {
    try {
      const apiUrl = 'https://tpcrm.onrender.com';
      const formData = new URLSearchParams()
      formData.append('username', email)
      formData.append('password', password)

      const response = await fetch(`${apiUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        const mockUser = {
          ...data.user,
          getIdToken: async () => data.access_token
        }
        
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setCurrentUser(mockUser)
        
        // Log into Firebase using the custom token so Firestore works
        if (data.firebase_token) {
          try {
            await signInWithCustomToken(auth, data.firebase_token)
          } catch (fbErr) {
            console.error('Firebase custom auth failed:', fbErr)
          }
        }
        
        return
      } else {
        const errData = await response.json().catch(() => ({}))
        const errorDetail = errData.detail || `Server error ${response.status}`
        const fbError = new Error(errorDetail)
        if (response.status === 401 || response.status === 400) {
           ;(fbError as any).code = 'auth/invalid-credential'
        } else if (response.status === 404) {
           // If the endpoint isn't found, Render hasn't deployed it yet or the URL is wrong
           fbError.message = 'Backend authentication endpoint not found. Please ensure backend is updated.'
           ;(fbError as any).code = 'auth/server-error'
        }
        throw fbError
      }
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        e.message = 'Network error: Could not connect to backend. Please check VITE_API_URL and CORS.'
        e.code = 'auth/server-error'
      } else if (!e.code) {
        e.code = 'auth/server-error'
        if (!e.message) {
            e.message = 'An unknown error occurred during login.'
        }
      }
      throw e
    }
  }

  async function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    await signOut(auth)
    setCurrentUser(null)
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

