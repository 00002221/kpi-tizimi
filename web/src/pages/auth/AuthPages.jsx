import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../supabase.js'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Field, LangSwitch } from '../../components/ui.jsx'
import { errorText } from '../../lib/utils.js'

export function AuthLayout({ title, sub, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-top"><LangSwitch /></div>
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/icon.svg" alt="" width="44" height="44" />
          <span>KPI</span>
        </div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
        {children}
      </div>
      {footer && <div className="auth-footer">{footer}</div>}
    </div>
  )
}

export function Login() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [forgot, setForgot] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(errorText(error, t))
    setBusy(false)
  }

  return (
    <AuthLayout
      title={t('auth.login_title')}
      sub={t('auth.login_sub')}
      footer={
        <>
          <Link to="/join">{t('auth.join_link')}</Link>
          <Link to="/register">{t('auth.register_link')}</Link>
        </>
      }
    >
      <form onSubmit={submit} className="stack">
        <Field label={t('auth.email')}>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('auth.password')}>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={busy} size="lg">{t('auth.login_btn')}</Button>
        <button type="button" className="link-btn forgot-link" aria-expanded={forgot} onClick={() => setForgot(!forgot)}>
          {t('auth.forgot')}
        </button>
        {forgot && <Alert kind="info">{t('auth.forgot_text')}</Alert>}
      </form>
    </AuthLayout>
  )
}

function SignedUpNotice({ email }) {
  const { t } = useI18n()
  return (
    <AuthLayout title={t('auth.check_email_title')} footer={<Link to="/">{t('auth.back_to_login')}</Link>}>
      <p>{t('auth.check_email', { email })}</p>
    </AuthLayout>
  )
}

export function RegisterCompany() {
  const { t, lang } = useI18n()
  const [f, setF] = useState({ company: '', name: '', phone: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        data: { intent: 'create_company', company_name: f.company.trim(), full_name: f.name.trim(), phone: f.phone.trim(), lang },
      },
    })
    setBusy(false)
    if (error) return setError(errorText(error, t))
    if (!data.session) setDone(true) // email tasdiqlash yoqilgan
  }

  if (done) return <SignedUpNotice email={f.email} />

  return (
    <AuthLayout
      title={t('auth.register_title')}
      sub={t('auth.register_sub')}
      footer={<><Link to="/">{t('auth.have_account')}</Link><Link to="/join">{t('auth.join_link')}</Link></>}
    >
      <form onSubmit={submit} className="stack">
        <Field label={t('auth.company_name')}>
          <input required value={f.company} onChange={set('company')} placeholder={t('auth.company_ph')} />
        </Field>
        <Field label={t('auth.full_name')}>
          <input required autoComplete="name" value={f.name} onChange={set('name')} />
        </Field>
        <Field label={t('auth.phone')}>
          <input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="+998 90 123 45 67" />
        </Field>
        <Field label={t('auth.email')}>
          <input type="email" autoComplete="email" required value={f.email} onChange={set('email')} />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.password_hint')}>
          <input type="password" autoComplete="new-password" minLength={6} required value={f.password} onChange={set('password')} />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={busy} size="lg">{t('auth.register_btn')}</Button>
      </form>
    </AuthLayout>
  )
}

export function JoinCompany() {
  const { t, lang } = useI18n()
  const [params] = useSearchParams()
  const [f, setF] = useState({ code: (params.get('code') || '').toUpperCase(), name: '', phone: '', email: '', password: '' })
  const [companyName, setCompanyName] = useState(null)
  const [codeChecked, setCodeChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: k === 'code' ? e.target.value.toUpperCase() : e.target.value })

  useEffect(() => {
    const code = f.code.trim()
    setCodeChecked(false)
    setCompanyName(null)
    if (code.length < 6) return
    const id = setTimeout(async () => {
      const { data } = await supabase.rpc('check_join_code', { p_code: code })
      setCompanyName(data || null)
      setCodeChecked(true)
    }, 350)
    return () => clearTimeout(id)
  }, [f.code])

  const submit = async (e) => {
    e.preventDefault()
    if (!companyName) return setError(t('err.INVALID_CODE'))
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: { intent: 'join', join_code: f.code.trim(), full_name: f.name.trim(), phone: f.phone.trim(), lang } },
    })
    setBusy(false)
    if (error) return setError(errorText(error, t))
    if (!data.session) setDone(true)
  }

  if (done) return <SignedUpNotice email={f.email} />

  return (
    <AuthLayout
      title={t('auth.join_title')}
      sub={t('auth.join_sub')}
      footer={<><Link to="/">{t('auth.have_account')}</Link><Link to="/register">{t('auth.register_link')}</Link></>}
    >
      <form onSubmit={submit} className="stack">
        <Field
          label={t('auth.join_code')}
          hint={companyName ? t('auth.joining', { name: companyName }) : undefined}
          error={codeChecked && !companyName ? t('err.INVALID_CODE') : undefined}
        >
          <input required className="code-input" maxLength={6} value={f.code} onChange={set('code')} placeholder="ABC234" />
        </Field>
        <Field label={t('auth.full_name')}>
          <input required autoComplete="name" value={f.name} onChange={set('name')} />
        </Field>
        <Field label={t('auth.phone')}>
          <input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="+998 90 123 45 67" />
        </Field>
        <Field label={t('auth.email')}>
          <input type="email" autoComplete="email" required value={f.email} onChange={set('email')} />
        </Field>
        <Field label={t('auth.password')} hint={t('auth.password_hint')}>
          <input type="password" autoComplete="new-password" minLength={6} required value={f.password} onChange={set('password')} />
        </Field>
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" loading={busy} size="lg" disabled={!companyName}>{t('auth.join_btn')}</Button>
      </form>
    </AuthLayout>
  )
}
