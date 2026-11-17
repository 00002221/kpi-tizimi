import { useEffect, useState } from 'react'
import FaceEnroll from '../../components/FaceEnroll.jsx'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Field, Tabs } from '../../components/ui.jsx'
import { errorText } from '../../lib/utils.js'
import { AuthLayout } from './AuthPages.jsx'

// Hisob bor, lekin kompaniyaga biriktirilmagan (masalan, kod noto'g'ri edi yoki rad etildi)
export function NoCompany() {
  const { t, lang } = useI18n()
  const { user, refresh, signOut } = useAuth()
  const [mode, setMode] = useState('join')
  const [code, setCode] = useState('')
  const [company, setCompany] = useState('')
  const [name, setName] = useState(user?.user_metadata?.full_name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = mode === 'join'
      ? await supabase.rpc('join_company', { p_code: code.trim(), p_full_name: name.trim() })
      : await supabase.rpc('create_company', { p_name: company.trim(), p_full_name: name.trim(), p_lang: lang })
    setBusy(false)
    if (error) return setError(errorText(error, t))
    refresh()
  }

  return (
    <AuthLayout
      title={t('nocompany.title')}
      sub={t('nocompany.sub', { email: user?.email })}
      footer={<button className="link-btn" onClick={signOut}>{t('common.logout')}</button>}
    >
      <Tabs value={mode} onChange={setMode} items={[
        { value: 'join', label: t('nocompany.join') },
        { value: 'create', label: t('nocompany.create') },
      ]} />
      <form onSubmit={submit} className="stack">
        {mode === 'join' ? (
          <Field label={t('auth.join_code')}>
            <input required className="code-input" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
        ) : (
          <Field label={t('auth.company_name')}>
            <input required value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
        )}
        <Field label={t('auth.full_name')}>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={busy} size="lg">
          {mode === 'join' ? t('auth.join_btn') : t('auth.register_btn')}
        </Button>
      </form>
    </AuthLayout>
  )
}

export function Pending() {
  const { t } = useI18n()
  const { company, refresh, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [face, setFace] = useState(null)
  const loadFace = () => supabase.rpc('my_face_status').then(({ data }) => setFace(data || {}))
  useEffect(() => { loadFace() }, [])
  const check = async () => { setBusy(true); await refresh(); setBusy(false) }
  const leave = async () => { await supabase.rpc('leave_pending'); refresh() }
  return (
    <AuthLayout
      title={t('pending.title')}
      footer={<><button className="link-btn" onClick={leave}>{t('pending.other_code')}</button><button className="link-btn" onClick={signOut}>{t('common.logout')}</button></>}
    >
      <p>{t('pending.text', { company: company?.name || '' })}</p>
      {face?.required && !face.enrolled ? (
        <FaceEnroll onDone={loadFace} />
      ) : (
        <Button onClick={check} loading={busy} variant="secondary">{t('pending.check')}</Button>
      )}
    </AuthLayout>
  )
}

export function Inactive() {
  const { t } = useI18n()
  const { company, signOut } = useAuth()
  return (
    <AuthLayout title={t('inactive.title')} footer={<button className="link-btn" onClick={signOut}>{t('common.logout')}</button>}>
      <Alert kind="warn">{t('inactive.text', { company: company?.name || '' })}</Alert>
    </AuthLayout>
  )
}

// Admin vaqtinchalik parol bergan: davom etishdan oldin o'z parolini o'rnatadi
export function ForceNewPassword() {
  const { t } = useI18n()
  const { refresh, signOut } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (pw !== pw2) return setError(t('pw.mismatch'))
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) { setBusy(false); return setError(errorText(error, t)) }
    const r = await supabase.rpc('password_changed')
    setBusy(false)
    if (r.error) return setError(errorText(r.error, t))
    refresh()
  }

  return (
    <AuthLayout title={t('pw.force_title')} sub={t('pw.force_sub')} footer={<button className="link-btn" onClick={signOut}>{t('common.logout')}</button>}>
      <form onSubmit={submit} className="stack">
        <Field label={t('pw.new')}>
          <input type="password" autoComplete="new-password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label={t('pw.repeat')}>
          <input type="password" autoComplete="new-password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={busy} size="lg">{t('pw.save')}</Button>
      </form>
    </AuthLayout>
  )
}

// Yangi kompaniya: platforma egasi tasdiqlashini kutadi (har 30 soniyada o'zi tekshiradi)
export function CompanyPending() {
  const { t } = useI18n()
  const { company, refresh, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const id = setInterval(() => refresh(), 30000)
    return () => clearInterval(id)
  }, [refresh])
  const check = async () => { setBusy(true); await refresh(); setBusy(false) }
  return (
    <AuthLayout title={t('company_pending.title')} footer={<button className="link-btn" onClick={signOut}>{t('common.logout')}</button>}>
      <p>{t('company_pending.text', { company: company?.name || '' })}</p>
      <Button onClick={check} loading={busy} variant="secondary">{t('pending.check')}</Button>
    </AuthLayout>
  )
}

export function CompanyRejected() {
  const { t } = useI18n()
  const { company, signOut } = useAuth()
  return (
    <AuthLayout title={t('company_rejected.title')} footer={<button className="link-btn" onClick={signOut}>{t('common.logout')}</button>}>
      <Alert kind="warn">{t('company_rejected.text', { company: company?.name || '' })}</Alert>
    </AuthLayout>
  )
}
