import { useEffect, useState } from 'react'
import { listUsers } from '../../api/admin'
import { Link } from 'react-router-dom'
import './Admin.css'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch a large page to compute stats client-side
    Promise.all([
      listUsers({ limit: 100 }),
    ]).then(([usersRes]) => {
      const all = usersRes.data.data.users
      setStats({
        total:       usersRes.data.data.pagination.total,
        admins:      all.filter(u => u.role === 'admin').length,
        verified:    all.filter(u => u.isEmailVerified).length,
        unverified:  all.filter(u => !u.isEmailVerified).length,
        active:      all.filter(u => u.isActive).length,
        inactive:    all.filter(u => !u.isActive).length,
        recent:      [...all].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-container"><div className="spinner" /></div>

  const cards = [
    { icon: '👥', label: 'Total Users',    value: stats.total,      color: 'var(--ink)' },
    { icon: '🛡️', label: 'Admins',         value: stats.admins,     color: 'var(--accent)' },
    { icon: '✅', label: 'Email Verified', value: stats.verified,   color: 'var(--green)' },
    { icon: '⏳', label: 'Unverified',     value: stats.unverified, color: 'var(--accent3)', textColor: 'var(--ink)' },
    { icon: '🟢', label: 'Active',         value: stats.active,     color: 'var(--green)' },
    { icon: '🔴', label: 'Deactivated',    value: stats.inactive,   color: 'var(--red)' },
  ]

  return (
    <div className="page-container">
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-hand)', fontSize: '2.5rem' }}>
            🛡️ Admin Dashboard
          </h1>
          <p style={{ color: 'var(--ink-light)', fontWeight: 600 }}>
            Overview of your auth service
          </p>
        </div>
        <Link to="/admin/users" className="btn btn-primary">
          Manage Users →
        </Link>
      </div>

      {/* Stats */}
      <div className="admin-stat-grid">
        {cards.map(c => (
          <div
            key={c.label}
            className="admin-stat-card"
            style={{ background: c.color, color: c.textColor || 'white' }}
          >
            <div className="admin-stat-icon">{c.icon}</div>
            <div className="admin-stat-value">{c.value}</div>
            <div className="admin-stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Signups */}
      <div className="section-title" style={{ marginTop: '32px' }}>📋 Recent Signups</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {stats.recent.map(u => (
              <tr key={u._id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{u.fullName || '—'}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-light)' }}>@{u.username}</div>
                </td>
                <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                <td>
                  <span className={`badge ${u.isEmailVerified ? 'badge-verified' : 'badge-unverified'}`}>
                    {u.isEmailVerified ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
