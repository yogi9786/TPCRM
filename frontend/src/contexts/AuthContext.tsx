import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
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
      setCurrentUser(user)
      setLoading(false)
    })
    return unsub
  }, [])

  async function login(email: string, password: string) {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://tpcrm.onrender.com'
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (response.ok) {
        const data = await response.json()
        const mockUser = {
          ...data.user,
          getIdToken: async () => data.token
        }
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setCurrentUser(mockUser)
        return
      } else {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Login failed')
      }
    } catch (e: any) {
      if (e.message === 'Invalid email or password') {
        const fbError = new Error('Invalid email or password')
        ;(fbError as any).code = 'auth/invalid-credential'
        throw fbError
      }
      // Fallback to real Firebase Auth
      await signInWithEmailAndPassword(auth, email, password)
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

