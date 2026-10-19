import { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth'

const AuthContext = createContext(null)

const initialState = {
  user: null,
  loading: true,   // true while we check if already logged in
  error: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOADED':    return { ...state, loading: false, user: action.user, error: null }
    case 'LOGIN':     return { ...state, user: action.user, error: null, loading: false }
    case 'LOGOUT':    return { ...state, user: null, error: null, loading: false }
    case 'SET_ERROR': return { ...state, error: action.error, loading: false }
    case 'CLEAR_ERR': return { ...state, error: null }
    default:          return state
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // On mount: try to restore session from existing cookies
  useEffect(() => {
    getMe()
      .then(res  => dispatch({ type: 'LOADED', user: res.data.data.user }))
      .catch(()  => dispatch({ type: 'LOADED', user: null }))
  }, [])

  // Listen for forced logouts from the axios interceptor
  useEffect(() => {
    const handler = () => dispatch({ type: 'LOGOUT' })
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  const login = useCallback(async (credentials) => {
    const res = await apiLogin(credentials)
    dispatch({ type: 'LOGIN', user: res.data.data.user })
    return res.data.data.user
  }, [])

  const register = useCallback(async (data) => {
    const res = await apiRegister(data)
    return res.data
  }, [])

  const logout = useCallback(async () => {
    await apiLogout().catch(() => {})
    dispatch({ type: 'LOGOUT' })
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await getMe()
    dispatch({ type: 'LOGIN', user: res.data.data.user })
  }, [])

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERR' }), [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
