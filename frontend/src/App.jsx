import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, AdminRoute, GuestRoute } from './components/ProtectedRoute'
import Navbar from './components/Navbar'

import Login          from './pages/Login'
import Register       from './pages/Register'
import VerifyEmail    from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'

import Dashboard      from './pages/user/Dashboard'
import Profile        from './pages/user/Profile'
import Sessions       from './pages/user/Sessions'

import AdminDashboard from './pages/admin/AdminDashboard'
import UsersList      from './pages/admin/UsersList'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
          <Route path="/verify-email/:token"       element={<VerifyEmail />} />
          <Route path="/forgot-password"           element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          <Route path="/reset-password/:resetToken" element={<GuestRoute><ResetPassword /></GuestRoute>} />

          {/* User */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/sessions"  element={<ProtectedRoute><Sessions /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin"       element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><UsersList /></AdminRoute>} />

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-hand)', fontSize: '5rem', marginBottom: '16px' }}>
        404 ✗
      </h1>
      <p style={{ fontWeight: 700, marginBottom: '24px', color: 'var(--ink-light)' }}>
        This page doesn't exist in our notebook.
      </p>
      <a href="/" className="btn btn-primary">← Back to Home</a>
    </div>
  )
}
