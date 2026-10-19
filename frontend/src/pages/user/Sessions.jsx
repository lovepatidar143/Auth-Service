import { useEffect, useState } from 'react'
import { getSessions, revokeSession, revokeAllOther } from '../../api/auth'
import './User.css'

function deviceIcon(ua = '') {
  const u = ua.toLowerCase()
  if (u.includes('mobile') || u.includes('android') || u.includes('iphone')) return '📱'
  if (u.includes('tablet') || u.includes('ipad')) return '📱'
  if (u.includes('curl') || u.includes('postman') || u.includes('axios')) return '🔧'
  return '💻'
}

function formatDate(d) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [msg,      setMsg]      = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getSessions()
      setSessions(res.data.data.sessions)
    } catch {
      setMsg({ type: 'error', text: 'Failed to load sessions.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const revoke = async (id) => {
    try {
      await revokeSession(id)
      setSessions(s => s.filter(x => x.id !== id))
      setMsg({ type: 'success', text: '✅ Session revoked.' })
    } catch {
      setMsg({ type: 'error', text: 'Failed to revoke session.' })
    }
  }

  const revokeOthers = async () => {
    try {
      const res = await revokeAllOther()
      setMsg({ type: 'success', text: `✅ Revoked ${res.data.data.revokedSessions} other sessions.` })
      load()
    } catch {
      setMsg({ type: 'error', text: 'Failed.' })
    }
  }

  return (
    <div className="page-container">
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontFamily: 'var(--font-hand)', fontSize: '2.2rem' }}>
          🔑 Active Sessions
        </h1>
        <div className="flex gap-2">
          <button className="btn btn-sm" onClick={load}>↻ Refresh</button>
          {sessions.filter(s => !s.isCurrent).length > 0 && (
            <button className="btn btn-sm btn-danger" onClick={revokeOthers}>
              Log out other devices
            </button>
          )}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {loading ? (
        <div className="spinner" />
      ) : sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
          <p style={{ fontWeight: 700, color: 'var(--ink-light)' }}>No active sessions found.</p>
        </div>
      ) : (
        <div>
          {sessions.map(s => (
            <div key={s.id} className={`session-card ${s.isCurrent ? 'current' : ''}`}>
              <div className="session-device">{deviceIcon(s.userAgent)}</div>
              <div className="session-info">
                <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {s.userAgent || 'Unknown device'}
                  {s.isCurrent && <span className="badge badge-verified" style={{ fontSize: '0.65rem' }}>This device</span>}
                </div>
                <div className="session-meta">
                  🌐 {s.ip || 'Unknown IP'} &nbsp;·&nbsp;
                  🕐 Last used: {formatDate(s.lastUsedAt)} &nbsp;·&nbsp;
                  📅 Expires: {formatDate(s.expiresAt)}
                </div>
              </div>
              {!s.isCurrent && (
                <button
                  className="btn btn-xs btn-danger"
                  onClick={() => revoke(s.id)}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
