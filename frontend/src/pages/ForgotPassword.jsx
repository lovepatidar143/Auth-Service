import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'
import './Auth.css'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState(null)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await forgotPassword(email)
      setDone(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card card-lg">
        <div className="corner-fold" />
        <div className="auth-header">
          <div className="auth-icon">🔏</div>
          <h1>Forgot password?</h1>
          <p className="text-muted text-sm">
            Enter your email — we'll send a reset link.
          </p>
        </div>

        {done ? (
          <div className="alert alert-success">
            📬 If an account exists for <strong>{email}</strong>, a reset link has been sent.
            Check your inbox!
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={submit}>
              <div className="form-group">
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="love@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send reset link →'}
              </button>
            </form>
          </>
        )}

        <div className="auth-footer">
          <Link to="/login" className="auth-link">← Back to login</Link>
        </div>
      </div>
    </div>
  )
}
