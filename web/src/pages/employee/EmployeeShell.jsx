import { NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { LangSwitch } from '../../components/ui.jsx'
import CheckIn from './CheckIn.jsx'
import MyTasks from './MyTasks.jsx'
import MyStats from './MyStats.jsx'
import Profile from './Profile.jsx'

const Icon = {
  today: <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />,
  tasks: <path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />,
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" />,
  profile: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z" />,
}

export default function EmployeeShell() {
  const { t } = useI18n()
  const { company } = useAuth()
  const items = [
    { to: '/', label: t('nav.today'), icon: Icon.today, end: true },
    { to: '/tasks', label: t('nav.my_tasks'), icon: Icon.tasks },
    { to: '/stats', label: t('nav.my_stats'), icon: Icon.stats },
    { to: '/profile', label: t('nav.profile'), icon: Icon.profile },
  ]
  return (
    <div className="emp-shell">
      <header className="emp-top">
        <span className="emp-company">{company?.name}</span>
        <LangSwitch />
      </header>
      <main className="emp-main">
        <Routes>
          <Route path="/" element={<CheckIn />} />
          <Route path="/tasks" element={<MyTasks />} />
          <Route path="/stats" element={<MyStats />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<CheckIn />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{it.icon}</svg>
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
