import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, LangSwitch, Modal } from '../../components/ui.jsx'
import { supabase } from '../../supabase.js'
import Dashboard from './Dashboard.jsx'
import Attendance from './Attendance.jsx'
import Employees from './Employees.jsx'
import Tasks from './Tasks.jsx'
import Ratings from './Ratings.jsx'
import Payroll from './Payroll.jsx'
import Settings from './Settings.jsx'
import Platform from './Platform.jsx'
import CheckIn from '../employee/CheckIn.jsx'
import Profile from '../employee/Profile.jsx'

const I = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.4.6 4 2.3 4 5.2" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  tasks: <path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  pin: <><path d="M12 21s-7-7.2-7-12a7 7 0 0 1 14 0c0 4.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  out: <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" />,
  building: <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M2 21h20M8 8h3M8 12h3M8 16h3" />,
}
// Sayt kutayotgan baza versiyasi (supabase/schema.sql dagi schema_version() bilan bir xil bo'lsin)
export const REQUIRED_DB = 5

// Sayt yangilanib, baza eski qolsa — adminga darhol ko'rinadigan ogohlantirish
function DbVersionWarning() {
  const { t } = useI18n()
  const [have, setHave] = useState(null)
  useEffect(() => {
    supabase.rpc('schema_version').then(({ data, error }) => setHave(error ? 0 : data))
  }, [])
  if (have == null || have >= REQUIRED_DB) return null
  return <div style={{ marginBottom: 16 }}><Alert kind="error">{t('db.outdated', { have: have || '?', need: REQUIRED_DB })}</Alert></div>
}

const Svg = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

export default function AdminShell() {
  const { t } = useI18n()
  const { company, member, signOut } = useAuth()
  const [more, setMore] = useState(false)
  const [isPlatform, setIsPlatform] = useState(false)
  useEffect(() => { supabase.rpc('is_platform_admin').then(({ data }) => setIsPlatform(Boolean(data))) }, [])
  const loc = useLocation()
  useEffect(() => setMore(false), [loc.pathname])

  const nav = [
    { to: '/', label: t('nav.dashboard'), end: true },
    { to: '/attendance', label: t('nav.attendance') },
    { to: '/employees', label: t('nav.employees') },
    { to: '/tasks', label: t('nav.tasks') },
    { to: '/ratings', label: t('nav.ratings') },
    { to: '/payroll', label: t('nav.payroll') },
    { to: '/settings', label: t('nav.settings') },
    ...(isPlatform ? [{ to: '/platform', label: t('nav.platform') }] : []),
  ]
  const personal = [
    { to: '/me', label: t('nav.my_checkin') },
    { to: '/profile', label: t('nav.profile') },
  ]
  const bottom = [
    { to: '/', label: t('nav.home_s'), icon: I.home, end: true },
    { to: '/attendance', label: t('nav.att_s'), icon: I.clock },
    { to: '/employees', label: t('nav.employees'), icon: I.people },
    { to: '/payroll', label: 'KPI', icon: I.chart },
  ]
  const moreItems = [
    { to: '/tasks', label: t('nav.tasks'), icon: I.tasks },
    { to: '/ratings', label: t('nav.ratings'), icon: I.star },
    { to: '/settings', label: t('nav.settings'), icon: I.gear },
    ...(isPlatform ? [{ to: '/platform', label: t('nav.platform'), icon: I.building }] : []),
    { to: '/me', label: t('nav.my_checkin'), icon: I.pin },
    { to: '/profile', label: t('nav.profile'), icon: I.user },
  ]
  const moreActive = moreItems.some((m) => loc.pathname === m.to)

  return (
    <div className="admin-shell">
      <aside className="sidebar">
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

      <div className="admin-main">
        <main className="admin-content">
          <DbVersionWarning />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/ratings" element={<Ratings />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/settings" element={<Settings />} />
            {isPlatform && <Route path="/platform" element={<Platform />} />}
            <Route path="/me" element={<div className="narrow"><CheckIn embedded /></div>} />
            <Route path="/profile" element={<div className="narrow"><Profile /></div>} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>

      <nav className="admin-bottomnav" aria-label={t('nav.menu')}>
        {bottom.map((b) => (
          <NavLink key={b.to} to={b.to} end={b.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <Svg d={b.icon} /><span>{b.label}</span>
          </NavLink>
        ))}
        <button className={moreActive ? 'active' : undefined} onClick={() => setMore(true)} aria-haspopup="dialog">
          <Svg d={I.more} /><span>{t('nav.more')}</span>
        </button>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title={company?.name || ''}>
        <ul className="more-list">
          {moreItems.map((m) => (
            <li key={m.to}><NavLink to={m.to}><Svg d={m.icon} />{m.label}</NavLink></li>
          ))}
          <li><button onClick={signOut}><Svg d={I.out} />{t('common.logout')}</button></li>
        </ul>
        <div className="more-foot">
          <span className="muted small">{member.full_name}</span>
          <LangSwitch />
        </div>
      </Modal>
    </div>
  )
}
