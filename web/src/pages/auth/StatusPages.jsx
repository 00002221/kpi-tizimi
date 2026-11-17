import { useState } from 'react'
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
  const check = async () => { setBusy(true); await refresh(); setBusy(false) }
  const leave = async () => { await supabase.rpc('leave_pending'); refresh() }
  return (
    <AuthLayout
      title={t('pending.title')}
      footer={<><button className="link-btn" onClick={leave}>{t('pending.other_code')}</button><button className="link-btn" onClick={signOut}>{t('common.logout')}</button></>}
    >
      <p>{t('pending.text', { company: company?.name || '' })}</p>
      <Button onClick={check} loading={busy} variant="secondary">{t('pending.check')}</Button>
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
