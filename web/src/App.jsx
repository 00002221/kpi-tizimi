import { Navigate, Route, Routes } from 'react-router-dom'
import { configured } from './supabase.js'
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx'
import { useI18n } from './i18n/index.jsx'
import { Spinner } from './components/ui.jsx'
import { Login, RegisterCompany, JoinCompany } from './pages/auth/AuthPages.jsx'
import { NoCompany, Pending, Inactive } from './pages/auth/StatusPages.jsx'
import EmployeeShell from './pages/employee/EmployeeShell.jsx'
import AdminShell from './pages/admin/AdminShell.jsx'

export default function App() {
  if (!configured) return <SetupNeeded />
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { session, member, loading } = useAuth()
  const { t } = useI18n()

  if (loading) return <div className="full-center"><Spinner label={t('common.loading')} /></div>

  if (!session) {
    return (
      <Routes>
        <Route path="/register" element={<RegisterCompany />} />
        <Route path="/join" element={<JoinCompany />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  if (!member) return <NoCompany />
  if (member.status === 'pending') return <Pending />
  if (member.status === 'inactive') return <Inactive />
  if (member.role === 'admin') return <AdminShell />
  return (
    <Routes>
      <Route path="/*" element={<EmployeeShell />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

function SetupNeeded() {
  return (
    <div className="full-center">
      <div className="auth-card">
        <h1 className="brand-title">KPI tizimi</h1>
        <p>
          <b>.env</b> faylida <code>VITE_SUPABASE_URL</code> va <code>VITE_SUPABASE_ANON_KEY</code> ko'rsatilmagan.
          README.md dagi ko'rsatmaga qarang.
        </p>
      </div>
    </div>
  )
}
