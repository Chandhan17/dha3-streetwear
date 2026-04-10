import { onAuthStateChanged } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { auth } from '../firebase'
import { getUserRole } from '../services/authService'

function ProtectedRoute({ children }) {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let isMounted = true

    // Keep route guard in sync with Firebase auth session state.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) {
        return
      }

      if (!user) {
        setIsAuthenticated(false)
        setIsAdmin(false)
        setIsCheckingAuth(false)
        return
      }

      try {
        const role = await getUserRole(user.uid)

        if (!isMounted) {
          return
        }

        setIsAuthenticated(true)
        setIsAdmin(role === 'admin')
      } catch {
        if (!isMounted) {
          return
        }

        setIsAuthenticated(false)
        setIsAdmin(false)
      }

      setIsCheckingAuth(false)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <p className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/75 shadow-soft">
          Checking admin access...
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ alert: 'Please sign in to continue.' }}
      />
    )
  }

  if (!isAdmin) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ alert: 'Admin access required.' }}
      />
    )
  }

  return children
}

export default ProtectedRoute