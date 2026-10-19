import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile, changePassword, deleteAccount, resendVerification } from '../../api/auth'
import { useNavigate } from 'react-router-dom'
import './User.css'

function useLocationState() {
  try { return window.history.state?.usr || {} } catch { return {} }
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const locState  = useLocationState()
  const [tab, setTab] = useState(locState.tab || 'profile')

  return (
    <div className="page-container">
      <h1 style={{ fontFamily: 'var(--font-hand)', fontSize: '2.2rem', marginBottom: '24px' }}>
        ✏️ My Profile
      </h1>

      <div className="tabs">
        {['profile', 'password', 'verify', 'danger'].map(t => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {{ profile: '👤 Info', password: '🔐 Password', verify: '✉️ Email', danger: '⚠️ Account' }[t]}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'profile'   && <ProfileTab   user={user} onSave={refreshUser} />}
        {tab === 'password'  && <PasswordTab  user={user} />}
        {tab === 'verify'    && <VerifyTab    user={user} />}
        {tab === 'danger'    && <DangerTab    logout={logout} navigate={navigate} />}
      </div>
    </div>
  )
}

/* ---- Profile Info Tab ---- */
function ProfileTab({ user, onSave }) {
  const [form, setForm] = useState({
    fullName:  user.fullName  || '',
    username:  user.username  || '',
    avatarUrl: user.avatar?.url || '',
  })
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState(null)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const payload = {}
      if (form.fullName  !== (user.fullName  || '')) payload.fullName  = form.fullName
      if (form.username  !== user.username)          payload.username  = form.username
      if (form.avatarUrl !== (user.avatar?.url || '')) payload.avatarUrl = form.avatarUrl
      if (!Object.keys(payload).length) {
        setMsg({ type: 'info', text: 'No changes to save.' })
        return
      }
      await updateProfile(payload)
      await onSave()
      setMsg({ type: 'success', text: '✅ Profile updated!' })
    } catch (err) {
      const errs = err.response?.data?.errors || []
      const m    = err.response?.data?.message || 'Update failed'
      setMsg({ type: 'error', text: errs.length ? errs.map(e => e.message).join(' · ') : m })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <div className="form-group">
        <label className="label">Full Name</label>
        <input className="input" name="fullName" value={form.fullName} onChange={handle} placeholder="Love Patidar" />
      </div>
      <div className="form-group">
        <label className="label">Username</label>
        <input className="input" name="username" value={form.username} onChange={handle} />
      </div>
      <div className="form-group">
        <label className="label">Avatar URL</label>
        <input className="input" name="avatarUrl" value={form.avatarUrl} onChange={handle} placeholder="https://..." />
      </div>
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Saving…' : 'Save changes →'}
      </button>
    </form>
  )
}

/* ---- Password Tab ---- */
function PasswordTab() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState(null)
  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (form.newPassword !== form.confirm) {
      setMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      await changePassword(form.currentPassword, form.newPassword)
      setMsg({ type: 'success', text: '✅ Password changed! Other devices were logged out.' })
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
    } catch (err) {
      const errs = err.response?.data?.errors || []
      const m    = err.response?.data?.message || 'Change failed'
      setMsg({ type: 'error', text: errs.length ? errs.map(e => e.message).join(' · ') : m })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {[
        { name: 'currentPassword', label: 'Current Password' },
        { name: 'newPassword',     label: 'New Password' },
        { name: 'confirm',         label: 'Confirm New Password' },
      ].map(f => (
        <div className="form-group" key={f.name}>
          <label className="label">{f.label}</label>
          <input className="input" name={f.name} type="password" value={form[f.name]} onChange={handle} required />
        </div>
      ))}
      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? 'Changing…' : 'Change password →'}
      </button>
    </form>
  )
}

/* ---- Verify Email Tab ---- */
function VerifyTab({ user }) {
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState(null)

  const resend = async () => {
    setLoading(true)
    setMsg(null)
    try {
      await resendVerification(user.email)
      setMsg({ type: 'success', text: '📬 Verification email sent! Check your inbox.' })
    } catch {
      setMsg({ type: 'error', text: 'Failed to send. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  if (user.isEmailVerified) {
    return (
      <div className="alert alert-success">
        ✅ Your email <strong>{user.email}</strong> is already verified. You're all set!
      </div>
    )
  }

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      <p style={{ fontWeight: 600, marginBottom: '16px' }}>
        Your email <strong>{user.email}</strong> hasn't been verified yet.
        Click below to resend the link.
      </p>
      <button className="btn btn-accent" onClick={resend} disabled={loading}>
        {loading ? 'Sending…' : '📬 Resend verification email'}
      </button>
    </div>
  )
}

/* ---- Danger Zone Tab ---- */
function DangerTab({ logout, navigate }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const del = async () => {
    setLoading(true)
    setError(null)
    try {
      await deleteAccount(password)
      await logout()
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Deletion failed.')
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="alert alert-error" style={{ marginBottom: '24px' }}>
        ⚠️ <strong>Danger Zone.</strong> Deleting your account is permanent and cannot be undone.
        All your sessions will be terminated.
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {!confirm ? (
        <button className="btn btn-danger" onClick={() => setConfirm(true)}>
          🗑️ Delete my account
        </button>
      ) : (
        <div>
          <div className="form-group">
            <label className="label">Confirm with your password</label>
            <input
              className="input"
              type="password"
              placeholder="Your current password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button className="btn btn-danger" onClick={del} disabled={loading || !password}>
              {loading ? 'Deleting…' : '🗑️ Yes, delete forever'}
            </button>
            <button className="btn" onClick={() => { setConfirm(false); setPassword('') }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
