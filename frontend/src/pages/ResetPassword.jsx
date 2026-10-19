import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import './Auth.css'

export default function ResetPassword() {
  const { resetToken } = useParams()
  const navigate = useNavigate()

  const [form, setForm]       = useState({ newPassword: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [done,    setDone]    = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await resetPassword(resetToken, form.newPassword)
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      const errs = err.response?.data?.errors || []
      const msg  = err.response?.data?.message || 'Reset failed'
      setError(errs.length ? errs.map(e => e.message).join(' · ') : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card card-lg">
        <div className="corner-fold" />
        <div className="auth-header">
          <div className="auth-icon">🔑</div>
          <h1>Reset password</h1>
          <p className="text-muted text-sm">Choose a strong new password</p>
        </div>

        {done ? (
          <>
            <div className="alert alert-success">
              ✅ Password reset! Redirecting to login…
            </div>
            <Link to="/login" className="btn btn-primary w-full">Go to Login →</Link>
          </>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="label">New Password</label>
                <input
                  className="input"
                  name="newPassword"
                  type="password"
                  placeholder="Min 8 chars, A-Z, a-z, 0-9"
                  value={form.newPassword}
                  onChange={handle}
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Confirm Password</label>
                <input
                  className="input"
                  name="confirm"
                  type="password"
                  placeholder="Repeat new password"
                  value={form.confirm}
                  onChange={handle}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Resetting…' : 'Reset password →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
