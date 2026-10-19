import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '', username: '', password: '', fullName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await register(form)
      setSuccess(true)
    } catch (err) {
      const errs = err.response?.data?.errors || []
      const msg  = err.response?.data?.message || 'Registration failed'
      setError(errs.length ? errs.map(e => e.message).join(' · ') : msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card card card-lg" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📬</div>
          <h2 style={{ fontFamily: 'var(--font-hand)', fontSize: '2rem', marginBottom: '12px' }}>
            Check your inbox!
          </h2>
          <p style={{ color: 'var(--ink-light)', fontWeight: 600, marginBottom: '24px' }}>
            We sent a verification link to <strong>{form.email}</strong>.
            Click it to activate your account.
          </p>
          <Link to="/login" className="btn btn-primary">
            Go to Login →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card card card-lg">
        <div className="corner-fold" />

        <div className="auth-header">
          <div className="auth-icon">📝</div>
          <h1>Create account</h1>
          <p className="text-muted text-sm">Start your notebook today</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Full Name <span className="text-muted">(optional)</span></label>
            <input
              className="input"
              name="fullName"
              type="text"
              placeholder="Love Patidar"
              value={form.fullName}
              onChange={handle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="label">Username</label>
              <input
                className="input"
                name="username"
                type="text"
                placeholder="lovepatidar"
                value={form.username}
                onChange={handle}
                required
              />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input
                className="input"
                name="email"
                type="email"
                placeholder="love@example.com"
                value={form.email}
                onChange={handle}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <input
              className="input"
              name="password"
              type="password"
              placeholder="Min 8 chars — mix of A-Z, a-z, 0-9"
              value={form.password}
              onChange={handle}
              required
            />
            <p className="text-muted text-sm mt-1">
              Must be 8–64 chars with uppercase, lowercase & a number.
            </p>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create account →'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
