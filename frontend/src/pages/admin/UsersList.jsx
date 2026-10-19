import { useEffect, useState, useCallback, useRef } from 'react'
import { listUsers, updateRole, updateStatus } from '../../api/admin'
import { useAuth } from '../../context/AuthContext'
import './Admin.css'

const ROLES = ['user', 'admin']
const ROLE_OPTS  = [{ value: '', label: 'All Roles' }, ...ROLES.map(r => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))]
const VER_OPTS   = [
  { value: '',     label: 'All' },
  { value: 'true', label: '✅ Verified' },
  { value: 'false',label: '⏳ Unverified' },
]
const SORT_OPTS  = [
  { value: '',              label: 'Newest first' },
  { value: 'oldest',        label: 'Oldest first' },
  { value: 'az',            label: 'A → Z (username)' },
  { value: 'za',            label: 'Z → A (username)' },
  { value: 'verified_yes',  label: 'Verified first' },
  { value: 'verified_no',   label: 'Unverified first' },
  { value: 'active_yes',    label: 'Active first' },
  { value: 'active_no',     label: 'Inactive first' },
]
const STATUS_OPTS = [
  { value: '',     label: 'All Status' },
  { value: 'true', label: '🟢 Active' },
  { value: 'false',label: '🔴 Inactive' },
]

function fmt(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function sortUsers(users, sortKey) {
  const arr = [...users]
  switch (sortKey) {
    case 'oldest':       return arr.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
    case 'az':           return arr.sort((a,b) => a.username.localeCompare(b.username))
    case 'za':           return arr.sort((a,b) => b.username.localeCompare(a.username))
    case 'verified_yes': return arr.sort((a,b) => Number(b.isEmailVerified) - Number(a.isEmailVerified))
    case 'verified_no':  return arr.sort((a,b) => Number(a.isEmailVerified) - Number(b.isEmailVerified))
    case 'active_yes':   return arr.sort((a,b) => Number(b.isActive) - Number(a.isActive))
    case 'active_no':    return arr.sort((a,b) => Number(a.isActive) - Number(b.isActive))
    default:             return arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
}

/* ---- Role change modal ---- */
function RoleModal({ user, onClose, onSave }) {
  const [role,    setRole]    = useState(user.role)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const save = async () => {
    if (role === user.role) { onClose(); return }
    setLoading(true)
    setError(null)
    try {
      const res = await updateRole(user._id, role)
      onSave(res.data.data.user)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role')
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>🎭 Change Role</h3>
        <p style={{ fontWeight: 600, marginBottom: '16px', color: 'var(--ink-light)' }}>
          User: <strong>@{user.username}</strong>
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-group">
          <label className="label">New Role</label>
          <select className="input" value={role} onChange={e => setRole(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex gap-3 mt-3">
          <button className="btn btn-primary" onClick={save} disabled={loading}>
            {loading ? 'Saving…' : 'Save →'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/* ---- Confirm action modal ---- */
function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, danger }) {
  const [loading, setLoading] = useState(false)
  const go = async () => {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h3>{title}</h3>
        <p style={{ fontWeight: 600, marginBottom: '20px', color: 'var(--ink-light)', lineHeight: 1.6 }}>{message}</p>
        <div className="flex gap-3">
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={go} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/* ===== Main Component ===== */
export default function UsersList() {
  const { user: me } = useAuth()

  const [users,      setUsers]     = useState([])
  const [pagination, setPagination]= useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [loading,    setLoading]   = useState(true)
  const [fetchErr,   setFetchErr]  = useState(null)
  const [toast,      setToast]     = useState(null)

  // Filters
  const [search,     setSearch]    = useState('')
  const [filterRole, setFilterRole]= useState('')
  const [filterVer,  setFilterVer] = useState('')
  const [filterStat, setFilterStat]= useState('')
  const [sortKey,    setSortKey]   = useState('')
  const [page,       setPage]      = useState(1)

  // Modals
  const [roleModal,   setRoleModal]  = useState(null) // user object
  const [statusModal, setStatusModal]= useState(null) // { user, targetActive }
  const searchTimer = useRef(null)

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async (p = page) => {
    setLoading(true)
    setFetchErr(null)
    try {
      const params = { page: p, limit: pagination.limit }
      if (search)     params.search = search
      if (filterRole) params.role   = filterRole
      const res = await listUsers(params)
      let rows = res.data.data.users

      // Client-side filters for verified/status (backend doesn't have these filters)
      if (filterVer  === 'true')  rows = rows.filter(u => u.isEmailVerified)
      if (filterVer  === 'false') rows = rows.filter(u => !u.isEmailVerified)
      if (filterStat === 'true')  rows = rows.filter(u => u.isActive)
      if (filterStat === 'false') rows = rows.filter(u => !u.isActive)

      rows = sortUsers(rows, sortKey)
      setUsers(rows)
      setPagination(res.data.data.pagination)
    } catch {
      setFetchErr('Failed to load users. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [page, search, filterRole, filterVer, filterStat, sortKey, pagination.limit])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); load(1) }, 350)
    return () => clearTimeout(searchTimer.current)
  }, [search, filterRole, filterVer, filterStat, sortKey])

  useEffect(() => { load(page) }, [page])

  // After role change, patch the user in local state
  const handleRoleSaved = (updated) => {
    setUsers(us => us.map(u => u._id === updated._id ? updated : u))
    showToast('success', `✅ @${updated.username} is now a ${updated.role}`)
  }

  // Toggle status
  const handleStatusToggle = async (target, targetActive) => {
    try {
      const res = await updateStatus(target._id, targetActive)
      const updated = res.data.data.user
      setUsers(us => us.map(u => u._id === updated._id ? updated : u))
      showToast('success', targetActive
        ? `✅ @${updated.username} activated`
        : `🔴 @${updated.username} deactivated`)
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to update status')
    } finally {
      setStatusModal(null)
    }
  }

  const totalPages = pagination.totalPages

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div
          className={`alert alert-${toast.type}`}
          style={{ position: 'fixed', top: '72px', right: '20px', zIndex: 999, maxWidth: '360px', boxShadow: 'var(--shadow-lg)' }}
        >
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-hand)', fontSize: '2.3rem' }}>
            👥 User Management
          </h1>
          <p style={{ fontWeight: 600, color: 'var(--ink-light)' }}>
            {pagination.total} total users
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {/* Search */}
        <div className="filter-group" style={{ flex: '1', minWidth: '200px' }}>
          <span className="filter-label">🔍 Search</span>
          <input
            className="input"
            placeholder="Username, email or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Role filter */}
        <div className="filter-group">
          <span className="filter-label">🎭 Role</span>
          <select className="input" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            {ROLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Verified filter */}
        <div className="filter-group">
          <span className="filter-label">✉️ Email</span>
          <select className="input" value={filterVer} onChange={e => setFilterVer(e.target.value)}>
            {VER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Status filter */}
        <div className="filter-group">
          <span className="filter-label">🟢 Status</span>
          <select className="input" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
            {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Sort */}
        <div className="filter-group">
          <span className="filter-label">↕️ Sort</span>
          <select className="input" value={sortKey} onChange={e => setSortKey(e.target.value)}>
            {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Reset */}
        {(search || filterRole || filterVer || filterStat || sortKey) && (
          <button
            className="btn btn-sm"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => { setSearch(''); setFilterRole(''); setFilterVer(''); setFilterStat(''); setSortKey('') }}
          >
            ✕ Reset
          </button>
        )}
      </div>

      {/* Error */}
      {fetchErr && <div className="alert alert-error">{fetchErr}</div>}

      {/* Table */}
      {loading ? (
        <div className="spinner" />
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>No users match your filters.</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const isMe = u._id === me?._id
                  return (
                    <tr key={u._id}>
                      <td style={{ color: 'var(--ink-light)', fontSize: '0.8rem' }}>
                        {(page - 1) * pagination.limit + i + 1}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Avatar circle */}
                          <div style={{
                            width: 34, height: 34, flexShrink: 0,
                            borderRadius: 3, border: '2px solid var(--ink)',
                            background: u.isEmailVerified ? 'var(--accent3)' : '#eee',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-hand)', fontWeight: 700, fontSize: '1rem',
                            overflow: 'hidden',
                          }}>
                            {u.avatar?.url
                              ? <img src={u.avatar.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : (u.fullName || u.username)[0].toUpperCase()
                            }
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                              {u.fullName || '—'}
                              {isMe && <span style={{ marginLeft: 6, fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent)' }}>(you)</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)' }}>@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{u.email}</td>
                      <td>
                        <span className={`badge badge-${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.isEmailVerified ? 'badge-verified' : 'badge-unverified'}`}>
                          {u.isEmailVerified ? '✓ Yes' : '✗ No'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                          {u.isActive ? 'Active' : 'Off'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--ink-light)' }}>
                        {fmt(u.createdAt)}
                      </td>
                      <td>
                        <div className="actions-cell">
                          {/* Change Role — cannot change own role */}
                          {!isMe && (
                            <button
                              className="btn btn-xs btn-accent2"
                              onClick={() => setRoleModal(u)}
                              title="Change role"
                            >
                              🎭 Role
                            </button>
                          )}
                          {/* Toggle Status — cannot change own status */}
                          {!isMe && (
                            u.isActive ? (
                              <button
                                className="btn btn-xs btn-danger"
                                onClick={() => setStatusModal({ user: u, targetActive: false })}
                                title="Deactivate"
                              >
                                🔴 Deactivate
                              </button>
                            ) : (
                              <button
                                className="btn btn-xs btn-success"
                                onClick={() => setStatusModal({ user: u, targetActive: true })}
                                title="Activate"
                              >
                                🟢 Activate
                              </button>
                            )
                          )}
                          {isMe && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--ink-light)', fontWeight: 700 }}>
                              (you)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ←
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                .reduce((acc, n, i, arr) => {
                  if (i > 0 && n - arr[i-1] > 1) acc.push('…')
                  acc.push(n)
                  return acc
                }, [])
                .map((n, i) =>
                  n === '…'
                    ? <span key={`e${i}`} style={{ fontWeight: 700, padding: '0 4px' }}>…</span>
                    : <button
                        key={n}
                        className={`page-btn ${page === n ? 'active' : ''}`}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                )
              }

              <button
                className="page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {roleModal && (
        <RoleModal
          user={roleModal}
          onClose={() => setRoleModal(null)}
          onSave={handleRoleSaved}
        />
      )}

      {statusModal && (
        <ConfirmModal
          title={statusModal.targetActive ? '🟢 Activate User' : '🔴 Deactivate User'}
          message={statusModal.targetActive
            ? `Activate @${statusModal.user.username}? They'll be able to log in again.`
            : `Deactivate @${statusModal.user.username}? They'll be logged out from all devices immediately.`
          }
          confirmLabel={statusModal.targetActive ? 'Activate' : 'Deactivate'}
          danger={!statusModal.targetActive}
          onClose={() => setStatusModal(null)}
          onConfirm={() => handleStatusToggle(statusModal.user, statusModal.targetActive)}
        />
      )}
    </div>
  )
}
