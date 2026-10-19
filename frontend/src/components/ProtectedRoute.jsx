import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="spinner" />
  if (!user)   return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading)                  return <div className="spinner" />
  if (!user)                    return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== 'admin')    return <Navigate to="/dashboard" replace />
  return children
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="spinner" />
  if (user)    return <Navigate to="/dashboard" replace />
  return children
}
