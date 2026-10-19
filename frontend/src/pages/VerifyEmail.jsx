import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { verifyEmail } from '../api/auth'
import './Auth.css'

export default function VerifyEmail() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('')

  useEffect(() => {
    verifyEmail(token)
      .then(() => setState('success'))
      .catch(err => {
        setMessage(err.response?.data?.message || 'Verification failed')
        setState('error')
      })
  }, [token])

  return (
    <div className="auth-page">
      <div className="auth-card card card-lg" style={{ textAlign: 'center' }}>
        {state === 'loading' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⏳</div>
            <h2 style={{ fontFamily: 'var(--font-hand)', fontSize: '2rem' }}>Verifying…</h2>
          </>
        )}
        {state === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>✅</div>
            <h2 style={{ fontFamily: 'var(--font-hand)', fontSize: '2.2rem', marginBottom: '12px' }}>
              Email verified!
            </h2>
            <p style={{ fontWeight: 600, color: 'var(--ink-light)', marginBottom: '24px' }}>
              Your account is now active. Go ahead and log in.
            </p>
            <Link to="/login" className="btn btn-primary">Sign in →</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>❌</div>
            <h2 style={{ fontFamily: 'var(--font-hand)', fontSize: '2rem', marginBottom: '12px' }}>
              Link invalid or expired
            </h2>
            <div className="alert alert-error">{message}</div>
            <Link to="/login" className="btn">Resend verification</Link>
          </>
        )}
      </div>
    </div>
  )
}
