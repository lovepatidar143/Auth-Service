import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import './User.css'

export default function Dashboard() {
  const { user } = useAuth()

  const stats = [
    { icon: '✉️', label: 'Email Verified', value: user.isEmailVerified ? 'Yes ✓' : 'Not yet ✗', ok: user.isEmailVerified },
    { icon: '🎭', label: 'Role',           value: user.role,             ok: true },
    { icon: '🟢', label: 'Account Status', value: user.isActive ? 'Active' : 'Deactivated', ok: user.isActive },
    { icon: '🕐', label: 'Member Since',   value: new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }), ok: true },
  ]

  return (
    <div className="page-container">
      {/* Header */}
      <div className="user-hero">
        <div className="user-avatar-big">
          {user.avatar?.url
            ? <img src={user.avatar.url} alt={user.username} />
            : <span>{(user.fullName || user.username)[0].toUpperCase()}</span>
          }
        </div>
        <div>
          <h1 className="user-greeting">
            Hey, <span className="doodle-underline">{user.fullName || user.username}</span> 👋
          </h1>
          <p className="text-muted" style={{ fontWeight: 600 }}>
            @{user.username} · {user.email}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.ok ? '' : 'stat-bad'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="section-title">✏️ Quick Actions</div>
      <div className="action-grid">
        <Link to="/profile" className="action-card card">
          <div className="action-icon">👤</div>
          <div className="action-label">Edit Profile</div>
          <div className="action-desc">Update your name, username, avatar</div>
        </Link>
        <Link to="/sessions" className="action-card card">
          <div className="action-icon">🔑</div>
          <div className="action-label">Active Sessions</div>
          <div className="action-desc">See & revoke logged-in devices</div>
        </Link>
        <Link to="/profile" state={{ tab: 'password' }} className="action-card card">
          <div className="action-icon">🔐</div>
          <div className="action-label">Change Password</div>
          <div className="action-desc">Keep your account secure</div>
        </Link>
        {!user.isEmailVerified && (
          <Link to="/profile" state={{ tab: 'verify' }} className="action-card card" style={{ borderColor: 'var(--accent)' }}>
            <div className="action-icon">📬</div>
            <div className="action-label">Verify Email</div>
            <div className="action-desc">Resend the verification email</div>
          </Link>
        )}
      </div>
    </div>
  )
}
