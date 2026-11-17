import { useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n, LANGS } from '../../i18n/index.jsx'
import { Button, Field, useToast } from '../../components/ui.jsx'
import { errorText } from '../../lib/utils.js'

export default function Profile() {
  const { t, lang, setLang } = useI18n()
  const { member, user, company, refresh, signOut } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(member.full_name)
  const [phone, setPhone] = useState(member.phone || '')
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.rpc('update_my_profile', { p_full_name: name, p_phone: phone })
    setBusy(false)
    if (error) return toast(errorText(error, t), 'error')
    toast(t('common.saved'))
    refresh()
  }

  const changePw = async (e) => {
    e.preventDefault()
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwBusy(false)
    if (error) return toast(errorText(error, t), 'error')
    setPw('')
    toast(t('profile.pw_changed'))
  }

  return (
    <div className="stack">
      <h1 className="page-title">{t('nav.profile')}</h1>
      <section className="panel">
        <p className="muted">{company?.name}{member.position ? `, ${member.position}` : ''}</p>
        <form className="stack" onSubmit={save}>
          <Field label={t('auth.full_name')}><input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t('auth.phone')}><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label={t('auth.email')}><input value={user.email} disabled /></Field>
          <Button type="submit" loading={busy}>{t('common.save')}</Button>
        </form>
      </section>
      <section className="panel">
        <h2>{t('profile.language')}</h2>
        <div className="seg">
          {LANGS.map((l) => (
            <button key={l.code} aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</button>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>{t('profile.password')}</h2>
        <form className="row-form" onSubmit={changePw}>
          <Field label={t('profile.new_password')} hint={t('auth.password_hint')}>
            <input type="password" minLength={6} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" loading={pwBusy}>{t('profile.change_pw')}</Button>
        </form>
      </section>
      <Button variant="ghost" onClick={signOut}>{t('common.logout')}</Button>
    </div>
  )
}
