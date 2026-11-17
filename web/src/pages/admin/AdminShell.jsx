import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { LangSwitch } from '../../components/ui.jsx'
import Dashboard from './Dashboard.jsx'
import Attendance from './Attendance.jsx'
import Employees from './Employees.jsx'
import Tasks from './Tasks.jsx'
import Ratings from './Ratings.jsx'
import Payroll from './Payroll.jsx'
import Settings from './Settings.jsx'
import CheckIn from '../employee/CheckIn.jsx'
import Profile from '../employee/Profile.jsx'

export default function AdminShell() {
  const { t } = useI18n()
  const { company, member, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  const nav = [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/attendance', label: t('nav.attendance') },
    { to: '/employees', label: t('nav.employees') },
    { to: '/tasks', label: t('nav.tasks') },
    { to: '/ratings', label: t('nav.ratings') },
    { to: '/payroll', label: t('nav.payroll') },
    { to: '/settings', label: t('nav.settings') },
  ]
  const personal = [
    { to: '/me', label: t('nav.my_checkin') },
    { to: '/profile', label: t('nav.profile') },
  ]

  return (
    <div className="admin-shell">
      <aside className={open ? 'sidebar sidebar-open' : 'sidebar'}>
        <div className="sidebar-brand">
          <img src="/icon.svg" alt="" width="34" height="34" />
          <div>
            <div className="sidebar-company">{company?.name}</div>
            <div className="sidebar-user">{member.full_name}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>{n.label}</NavLink>
          ))}
          <div className="sidebar-sep" />
          {personal.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>{n.label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <LangSwitch dark />
          <button className="link-btn link-light" onClick={signOut}>{t('common.logout')}</button>
        </div>
      </aside>
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label={t('nav.menu')}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <span className="admin-topbar-title">{company?.name}</span>
        </header>
        <main className="admin-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/ratings" element={<Ratings />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/me" element={<div className="narrow"><CheckIn /></div>} />
            <Route path="/profile" element={<div className="narrow"><Profile /></div>} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
