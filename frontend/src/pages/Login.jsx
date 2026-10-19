import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [form, setForm]       = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await login(form)
      navigate(user.role === 'admin' ? '/admin/users' : from, { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed'
      const errs = err.response?.data?.errors || []
      setError(errs.length ? errs.map(e => e.message).join(' · ') : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card card-lg">
        {/* Decorative corner fold */}
        <div className="corner-fold" />

        <div className="auth-header">
          <div className="auth-icon">✏️</div>
          <h1>Welcome back</h1>
          <p className="text-muted text-sm">Sign in to your notebook</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Email or Username</label>
            <input
              className="input"
              name="email"
              type="text"
              placeholder="love@example.com"
              value={form.email}
              onChange={handle}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <input
              className="input"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handle}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex justify-between items-center mb-4">
            <span />
            <Link to="/forgot-password" className="auth-link">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <div className="auth-footer">
          No account?{' '}
          <Link to="/register" className="auth-link">Create one</Link>
        </div>
      </div>
    </div>
  )
}
