import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n, LANGS } from '../../i18n/index.jsx'
import { Alert, Button, Field, PageHeader, Spinner, Toggle, useToast, useConfirm } from '../../components/ui.jsx'
import { errorText, fmtDate, getPosition, hhmm } from '../../lib/utils.js'
import TimeInput from '../../components/TimeInput.jsx'
import DayTimeline from '../../components/DayTimeline.jsx'

const MapPicker = lazy(() => import('../../components/MapPicker.jsx'))

const TIMEZONES = ['Asia/Tashkent', 'Asia/Samarkand', 'Asia/Almaty', 'Asia/Bishkek', 'Asia/Dushanbe', 'Europe/Moscow', 'Asia/Dubai', 'Europe/Istanbul', 'UTC']

export function WeekdayPicker({ value = [], onChange }) {
  const { t } = useI18n()
  const names = t('cal.weekdays').split(',')
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort())
  return (
    <div className="days7">
      {names.map((n, i) => (
        <button type="button" key={n} aria-pressed={value.includes(i + 1)} onClick={() => toggle(i + 1)}>{n}</button>
      ))}
    </div>
  )
}

const pickCompany = (c) => ({
  name: c.name, default_lang: c.default_lang, timezone: c.timezone, currency: c.currency,
  office_lat: c.office_lat, office_lng: c.office_lng, radius_m: c.radius_m, require_selfie: c.require_selfie,
  face_check: c.face_check,
  work_start: hhmm(c.work_start), work_end: hhmm(c.work_end), grace_minutes: c.grace_minutes,
  break_start: c.break_start ? hhmm(c.break_start) : '', break_end: c.break_end ? hhmm(c.break_end) : '',
  work_days: c.work_days || [],
  late_fine_per_case: c.late_fine_per_case, late_fine_per_minute: c.late_fine_per_minute,
  early_fine_per_minute: c.early_fine_per_minute, deduct_absent_days: c.deduct_absent_days,
  kpi_salary_share: c.kpi_salary_share, w_attendance: c.w_attendance, w_tasks: c.w_tasks, w_rating: c.w_rating,
  late_day_credit: Math.round(Number(c.late_day_credit) * 100),
})

export default function Settings() {
  const { t } = useI18n()
  const { company, refresh } = useAuth()
  const toast = useToast()
  const initial = useMemo(() => pickCompany(company), [company])
  const [f, setF] = useState(initial)
  useEffect(() => setF(initial), [initial])
  const same = (a, b) => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : String(a ?? '') === String(b ?? ''))
  const changed = Object.keys(initial).filter((k) => !same(initial[k], f[k])).length
  const [busy, setBusy] = useState(false)
  const [locBusy, setLocBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setV = (k, v) => setF({ ...f, [k]: v })
  const wSum = Number(f.w_attendance) + Number(f.w_tasks) + Number(f.w_rating)

  const useMyLocation = async () => {
    setLocBusy(true)
    try {
      const c = await getPosition()
      setF((x) => ({ ...x, office_lat: +c.latitude.toFixed(6), office_lng: +c.longitude.toFixed(6) }))
      toast(t('set.loc_taken', { n: Math.round(c.accuracy) }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
    setLocBusy(false)
  }

  const save = async () => {
    if (wSum !== 100) return toast(t('set.weights_error', { n: wSum }), 'error')
    setBusy(true)
    const num = (v) => Number(v) || 0
    const payload = {
      name: f.name.trim() || company.name, default_lang: f.default_lang, timezone: f.timezone, currency: f.currency.trim() || 'UZS',
      office_lat: f.office_lat === '' || f.office_lat == null ? null : Number(f.office_lat),
      office_lng: f.office_lng === '' || f.office_lng == null ? null : Number(f.office_lng),
      radius_m: Math.min(5000, Math.max(10, num(f.radius_m))), require_selfie: f.require_selfie,
      face_check: f.require_selfie && f.face_check,
      work_start: f.work_start, work_end: f.work_end, grace_minutes: num(f.grace_minutes),
      break_start: f.break_start || null, break_end: f.break_end || null, work_days: f.work_days,
      late_fine_per_case: num(f.late_fine_per_case), late_fine_per_minute: num(f.late_fine_per_minute),
      early_fine_per_minute: num(f.early_fine_per_minute), deduct_absent_days: f.deduct_absent_days,
      kpi_salary_share: num(f.kpi_salary_share), w_attendance: num(f.w_attendance), w_tasks: num(f.w_tasks),
      w_rating: num(f.w_rating), late_day_credit: Math.min(100, Math.max(0, num(f.late_day_credit))) / 100,
    }
    const { error } = await supabase.from('companies').update(payload).eq('id', company.id)
    setBusy(false)
    if (error) return toast(errorText(error, t), 'error')
    toast(t('common.saved'))
    refresh()
  }

  return (
    <div className="stack-lg settings">
      <PageHeader title={t('nav.settings')} />

      <section className="panel">
        <h2>{t('set.company')}</h2>
        <div className="form-grid">
          <Field label={t('auth.company_name')}><input value={f.name} onChange={set('name')} /></Field>
          <Field label={t('set.default_lang')} hint={t('set.default_lang_hint')}>
            <select value={f.default_lang} onChange={set('default_lang')}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </Field>
          <Field label={t('set.timezone')}>
            <select value={f.timezone} onChange={set('timezone')}>
              {[...new Set([f.timezone, ...TIMEZONES])].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <Field label={t('set.currency')}><input value={f.currency} onChange={set('currency')} maxLength={6} /></Field>
        </div>
      </section>

      <section className="panel">
        <h2>{t('set.office')}</h2>
        <p className="muted">{t('set.office_hint')}</p>
        <div className="office-grid">
          <Suspense fallback={<div className="map-box"><Spinner /></div>}>
            <MapPicker
              lat={f.office_lat} lng={f.office_lng} radius={Number(f.radius_m) || 100}
              onPick={(lat, lng) => setF((x) => ({ ...x, office_lat: +lat.toFixed(6), office_lng: +lng.toFixed(6) }))}
            />
          </Suspense>
          <div className="stack">
            <Button variant="secondary" onClick={useMyLocation} loading={locBusy}>{t('set.use_my_location')}</Button>
            <div className="grid-2-tight">
              <Field label={t('set.lat')}><input type="number" step="0.000001" value={f.office_lat ?? ''} onChange={set('office_lat')} /></Field>
              <Field label={t('set.lng')}><input type="number" step="0.000001" value={f.office_lng ?? ''} onChange={set('office_lng')} /></Field>
            </div>
            <Field label={t('set.radius', { n: f.radius_m })} hint={t('set.radius_hint')}>
              <input type="range" min="20" max="1000" step="10" value={f.radius_m} onChange={set('radius_m')} />
            </Field>
            <Toggle checked={f.require_selfie} onChange={(v) => setV('require_selfie', v)} label={t('set.require_selfie')} hint={t('set.require_selfie_hint')} />
            {f.require_selfie && (
              <Toggle checked={f.face_check} onChange={(v) => setV('face_check', v)} label={t('set.face_check')} hint={t('set.face_check_hint')} />
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{t('set.schedule')}</h2>
        <div className="stack">
          <div className="presets" role="group" aria-label={t('set.presets')}>
            {[['09:00', '18:00'], ['08:00', '17:00'], ['10:00', '19:00']].map(([a, b]) => (
              <button key={a} type="button" className="preset" aria-pressed={f.work_start === a && f.work_end === b}
                onClick={() => setF({ ...f, work_start: a, work_end: b })}>{a}–{b}</button>
            ))}
          </div>
          <DayTimeline schedule={{ work_start: f.work_start, work_end: f.work_end, grace_minutes: Number(f.grace_minutes) || 0, break_start: f.break_start || null, break_end: f.break_end || null }} />
          <div className="time-pair">
            <Field label={t('set.work_start')}><TimeInput value={f.work_start} onChange={(v) => setV('work_start', v)} /></Field>
            <Field label={t('set.work_end')}><TimeInput value={f.work_end} onChange={(v) => setV('work_end', v)} /></Field>
          </div>
          <label className="field">
            <span className="grace-row"><span className="field-label">{t('set.grace')}</span><b>{t('unit.min', { n: f.grace_minutes || 0 })}</b></span>
            <input type="range" min="0" max="60" step="1" value={f.grace_minutes || 0} onChange={set('grace_minutes')} />
            <span className="field-hint">{t('set.grace_hint')}</span>
          </label>
          <Toggle checked={Boolean(f.break_start)} onChange={(v) => setF({ ...f, break_start: v ? '13:00' : '', break_end: v ? '14:00' : '' })} label={t('set.has_break')} />
          {f.break_start && (
            <div className="time-pair">
              <Field label={t('set.break_start')}><TimeInput value={f.break_start} onChange={(v) => setV('break_start', v)} /></Field>
              <Field label={t('set.break_end')}><TimeInput value={f.break_end} onChange={(v) => setV('break_end', v)} /></Field>
            </div>
          )}
          <Field label={t('set.work_days')}><WeekdayPicker value={f.work_days} onChange={(v) => setV('work_days', v)} /></Field>
          <p className="muted small">{t('set.schedule_hint')}</p>
        </div>
      </section>

      <section className="panel">
        <h2>{t('set.fines')}</h2>
        <div className="form-grid">
          <Field label={t('set.late_per_case', { cur: f.currency })}><input type="number" min="0" step="1000" value={f.late_fine_per_case} onChange={set('late_fine_per_case')} /></Field>
          <Field label={t('set.late_per_min', { cur: f.currency })}><input type="number" min="0" step="100" value={f.late_fine_per_minute} onChange={set('late_fine_per_minute')} /></Field>
          <Field label={t('set.early_per_min', { cur: f.currency })}><input type="number" min="0" step="100" value={f.early_fine_per_minute} onChange={set('early_fine_per_minute')} /></Field>
        </div>
        <p className="muted small">{t('set.fines_hint')}</p>
        <Toggle checked={f.deduct_absent_days} onChange={(v) => setV('deduct_absent_days', v)} label={t('set.deduct_absent')} hint={t('set.deduct_absent_hint')} />
      </section>

      <section className="panel">
        <h2>{t('set.kpi')}</h2>
        <div className="form-grid">
          <Field label={t('set.w_attendance')}><input type="number" min="0" max="100" value={f.w_attendance} onChange={set('w_attendance')} /></Field>
          <Field label={t('set.w_tasks')}><input type="number" min="0" max="100" value={f.w_tasks} onChange={set('w_tasks')} /></Field>
          <Field label={t('set.w_rating')}><input type="number" min="0" max="100" value={f.w_rating} onChange={set('w_rating')} /></Field>
        </div>
        <p className={wSum === 100 ? 'muted small' : 'text-danger small'}>{t('set.weights_sum', { n: wSum })}</p>
        <div className="form-grid">
          <Field label={t('set.kpi_share')} hint={t('set.kpi_share_hint', { n: f.kpi_salary_share, m: 100 - Number(f.kpi_salary_share) })}>
            <input type="number" min="0" max="100" value={f.kpi_salary_share} onChange={set('kpi_salary_share')} />
          </Field>
          <Field label={t('set.late_credit')} hint={t('set.late_credit_hint')}>
            <input type="number" min="0" max="100" value={f.late_day_credit} onChange={set('late_day_credit')} />
          </Field>
        </div>
      </section>

      {changed > 0 && (
        <div className="save-bar" role="status">
          <span>{t('set.unsaved', { n: changed })}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="ghost" onClick={() => setF(initial)}>{t('common.cancel')}</Button>
            <Button onClick={save} loading={busy}>{t('common.save')}</Button>
          </div>
        </div>
      )}

      <TelegramSettings />
      <Holidays />
      <JoinCodeSettings />
    </div>
  )
}

function TelegramSettings() {
  const { t } = useI18n()
  const { company } = useAuth()
  const toast = useToast()
  const [f, setF] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('company_telegram').select('*').eq('company_id', company.id).maybeSingle().then(({ data }) => {
      setF(data || { company_id: company.id, enabled: false, notify_late: true, notify_checkin: false, notify_checkout: false, daily_summary: true, summary_time: '10:00', bot_token: '', chat_id: '' })
    })
  }, [company.id])

  if (!f) return <section className="panel"><Spinner /></section>
  const set = (k, v) => setF({ ...f, [k]: v })

  const save = async () => {
    setBusy(true)
    const payload = {
      company_id: company.id, bot_token: f.bot_token?.trim() || null, chat_id: f.chat_id?.trim() || null,
      enabled: f.enabled, notify_late: f.notify_late, notify_checkin: f.notify_checkin,
      notify_checkout: f.notify_checkout, daily_summary: f.daily_summary, summary_time: hhmm(f.summary_time),
    }
    const { error } = await supabase.from('company_telegram').upsert(payload, { onConflict: 'company_id' })
    setBusy(false)
    if (error) return toast(errorText(error, t), 'error')
    toast(t('common.saved'))
  }

  const test = async () => {
    await save()
    const { error } = await supabase.rpc('telegram_test')
    if (error) return toast(errorText(error, t), 'error')
    toast(t('tg.test_sent'))
  }

  return (
    <section className="panel">
      <h2>{t('tg.title')}</h2>
      <details className="howto">
        <summary>{t('tg.howto')}</summary>
        <ol>
          <li>{t('tg.step1')}</li>
          <li>{t('tg.step2')}</li>
          <li>{t('tg.step3')}</li>
          <li>{t('tg.step4')}</li>
        </ol>
      </details>
      <div className="form-grid">
        <Field label={t('tg.token')}><input value={f.bot_token || ''} onChange={(e) => set('bot_token', e.target.value)} placeholder="123456789:AA..." autoComplete="off" /></Field>
        <Field label={t('tg.chat_id')}><input value={f.chat_id || ''} onChange={(e) => set('chat_id', e.target.value)} placeholder="-1001234567890" /></Field>
      </div>
      <div className="stack">
        <Toggle checked={f.enabled} onChange={(v) => set('enabled', v)} label={t('tg.enabled')} />
        <Toggle checked={f.notify_late} onChange={(v) => set('notify_late', v)} label={t('tg.notify_late')} />
        <Toggle checked={f.notify_checkin} onChange={(v) => set('notify_checkin', v)} label={t('tg.notify_checkin')} />
        <Toggle checked={f.notify_checkout} onChange={(v) => set('notify_checkout', v)} label={t('tg.notify_checkout')} />
        <Toggle checked={f.daily_summary} onChange={(v) => set('daily_summary', v)} label={t('tg.daily_summary')} hint={t('tg.daily_summary_hint')} />
        {f.daily_summary && (
          <Field className="field-inline" label={t('tg.summary_time')}>
            <TimeInput value={hhmm(f.summary_time)} onChange={(v) => set('summary_time', v)} style={{ width: 110 }} />
          </Field>
        )}
      </div>
      <div className="row-end">
        <Button variant="ghost" onClick={test} disabled={!f.bot_token || !f.chat_id || !f.enabled}>{t('tg.test')}</Button>
        <Button onClick={save} loading={busy}>{t('common.save')}</Button>
      </div>
    </section>
  )
}

function Holidays() {
  const { t } = useI18n()
  const { company } = useAuth()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [day, setDay] = useState('')
  const [name, setName] = useState('')

  const load = () => supabase.from('holidays').select('*').eq('company_id', company.id).order('day', { ascending: false })
    .then(({ data }) => setList(data || []))
  useEffect(() => { load() }, [company.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('holidays').insert({ company_id: company.id, day, name: name.trim() || null })
    if (error) return toast(errorText(error, t), 'error')
    setDay(''); setName(''); load()
  }
  const remove = async (id) => {
    await supabase.from('holidays').delete().eq('id', id)
    load()
  }

  return (
    <section className="panel">
      <h2>{t('hol.title')}</h2>
      <p className="muted">{t('hol.hint')}</p>
      <form className="row-form" onSubmit={add}>
        <Field label={t('common.date')}><input type="date" required value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label={t('hol.name')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hol.name_ph')} /></Field>
        <Button type="submit" variant="secondary">{t('hol.add')}</Button>
      </form>
      {list && list.length > 0 && (
        <ul className="people-list">
          {list.map((h) => (
            <li key={h.id}>
              <span><b>{fmtDate(h.day)}</b> {h.name || ''}</span>
              <span />
              <Button size="sm" variant="danger-ghost" onClick={() => remove(h.id)}>{t('common.delete')}</Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function JoinCodeSettings() {
  const { t } = useI18n()
  const { company, refresh } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const regen = async () => {
    if (!await confirm(t('set.regen_confirm'))) return
    const { error } = await supabase.rpc('regenerate_join_code')
    if (error) return toast(errorText(error, t), 'error')
    refresh()
  }
  return (
    <section className="panel">
      <h2>{t('set.join_code')}</h2>
      <Alert kind="info" action={<Button variant="ghost" size="sm" onClick={regen}>{t('set.regen')}</Button>}>
        {t('set.join_code_text')} <b className="code-inline">{company.join_code}</b>
      </Alert>
    </section>
  )
}
