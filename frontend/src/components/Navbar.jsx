import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'

  const navLinks = isAdmin
    ? [
        { to: '/dashboard',      label: '📋 Dashboard' },
        { to: '/admin/users',    label: '👥 Users' },
        { to: '/profile',        label: '✏️ Profile' },
      ]
    : [
        { to: '/dashboard',      label: '🏠 Home' },
        { to: '/sessions',       label: '🔑 Sessions' },
        { to: '/profile',        label: '✏️ Profile' },
      ]

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">✒️</span>
          <span className="brand-name">AuthDoodle</span>
        </Link>

        {/* Desktop links */}
        {user && (
          <ul className="navbar-links">
            {navLinks.map(l => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className={`nav-link ${location.pathname.startsWith(l.to) ? 'active' : ''}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Right side */}
        <div className="navbar-right">
          {user ? (
            <>
              <div className="nav-user-pill">
                <span className={`badge ${isAdmin ? 'badge-admin' : 'badge-user'}`}>
                  {user.role}
                </span>
                <span className="nav-username">@{user.username}</span>
              </div>
              <button className="btn btn-sm" onClick={handleLogout}>
                Logout →
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <Link to="/login"    className="btn btn-sm">Login</Link>
              <Link to="/register" className="btn btn-sm btn-primary">Register</Link>
            </div>
          )}
          <button
            className="hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && user && (
        <div className="mobile-menu">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout →
          </button>
        </div>
      )}
    </nav>
  )
}
