import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Modal, Spinner, useToast } from '../../components/ui.jsx'
import CameraCapture from '../../components/CameraCapture.jsx'
import FaceEnroll from '../../components/FaceEnroll.jsx'
import SlideConfirm from '../../components/SlideConfirm.jsx'
import DayTimeline, { fromMin, toMin } from '../../components/DayTimeline.jsx'
import { faceDescriptor, loadFaceModels } from '../../lib/face.js'
import { cls, distanceM, errorText, fmtMinutes, fmtNum, fmtTime, getPosition, hhmm, monthStart, nowTimeIn } from '../../lib/utils.js'

const WEEKDAYS = { uz: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'] }
const MONTHS = { uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'] }

function longDate(dateStr, lang) {
  const d = new Date(dateStr + 'T12:00:00Z')
  if (lang === 'uz') return `${WEEKDAYS.uz[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS.uz[d.getUTCMonth()]}`
  const s = new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const fmtDist = (m) => (m >= 1000 ? `${fmtNum(m / 1000, 1)} km` : `${Math.round(m)} m`)

export default function CheckIn({ embedded }) {
  const { t, lang } = useI18n()
  const { member, company } = useAuth()
  const toast = useToast()
  const tz = company?.timezone || 'Asia/Tashkent'
  const [today, setToday] = useState(null)
  const [month, setMonth] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [clock, setClock] = useState(nowTimeIn(tz))
  const [phase, setPhase] = useState('idle') // idle | locating | camera | face | sending
  const [action, setAction] = useState(null) // 'in' | 'out'
  const [pos, setPos] = useState(null)
  const [error, setError] = useState(null)
  const [confirmEarly, setConfirmEarly] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_today')
    if (error) return setLoadErr(errorText(error, t))
    setToday(data)
    setLoadErr(null)
    const rep = await supabase.rpc('month_report', { p_month: monthStart(data.date) })
    setMonth((rep.data || []).find((r) => r.member_id === member.id) || null)
  }, [t, member.id])

  useEffect(() => { load() }, [load])
  const faceRequired = Boolean(today?.face?.required)
  useEffect(() => { if (faceRequired) loadFaceModels().catch(() => {}) }, [faceRequired])
  useEffect(() => {
    const id = setInterval(() => setClock(nowTimeIn(tz)), 1000 * 15)
    return () => clearInterval(id)
  }, [tz])

  if (loadErr) return <div className="today-body" style={{ paddingTop: 16 }}><Alert kind="error">{loadErr}</Alert></div>
  if (!today) return <Spinner />

  const office = today.office
  const att = today.attendance
  const s = today.schedule
  const checkedIn = Boolean(att?.check_in_at)
  const checkedOut = Boolean(att?.check_out_at)
  const needsFace = today.face?.required && !today.face.enrolled
  const busy = ['locating', 'face', 'sending'].includes(phase)

  const locate = async () => {
    const c = await getPosition()
    const p = { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy }
    p.distance = office.lat != null ? distanceM(office.lat, office.lng, p.latitude, p.longitude) : null
    setPos(p)
    return p
  }

  const checkLocation = async () => {
    setError(null)
    try { await locate() } catch (e) { setError(errorText(e, t)) }
  }

  const start = async (kind) => {
    setError(null)
    setAction(kind)
    setPhase('locating')
    try {
      const p = await locate()
      if (p.distance != null && p.distance > office.radius_m) {
        setError(t('err.OUT_OF_RANGE', { n: Math.round(p.distance) }))
        return setPhase('idle')
      }
      if (kind === 'in') {
        if (office.require_selfie) return setPhase('camera')
        return send('in', p, null)
      }
      if (today.is_workday && s.work_end && clock < hhmm(s.work_end)) {
        setPhase('idle')
        return setConfirmEarly(p)
      }
      return send('out', p)
    } catch (e) {
      setError(errorText(e, t))
      setPhase('idle')
    }
  }

  const send = async (kind, p, blob) => {
    setPhase('sending')
    try {
      let selfiePath = null
      let face = null
      if (kind === 'in' && blob && today.face?.required) {
        setPhase('face')
        try { face = await faceDescriptor(blob) } catch { face = null } // model yuklanmasa — "shubhali" bo'ladi
        setPhase('sending')
      }
      if (kind === 'in' && blob) {
        selfiePath = `${member.company_id}/${member.user_id}/${today.date}-${Date.now()}.jpg`
        const up = await supabase.storage.from('selfies').upload(selfiePath, blob, { contentType: 'image/jpeg' })
        if (up.error) throw up.error
      }
      const { data, error } = kind === 'in'
        ? await supabase.rpc('check_in', { p_lat: p.latitude, p_lng: p.longitude, p_accuracy: p.accuracy, p_selfie: selfiePath, p_face: face })
        : await supabase.rpc('check_out', { p_lat: p.latitude, p_lng: p.longitude, p_accuracy: p.accuracy })
      if (error) throw error
      if (kind === 'in') {
        toast(data.status === 'late' ? t('checkin.done_late', { n: data.late_minutes }) : t('checkin.done_ok'), data.status === 'late' ? 'warn' : 'ok')
        if (data.face_status === 'mismatch' || data.face_status === 'no_face') toast(t('face.flagged'), 'warn')
      } else {
        toast(t('checkout.done'))
      }
      await load()
    } catch (e) {
      setError(errorText(e, t))
    }
    setPhase('idle')
  }

  // Holat: ekran rangi va xabar
  const nowM = toMin(clock)
  const ws = toMin(s.work_start)
  const we = toMin(s.work_end)
  const graceEnd = ws + (s.grace_minutes || 0)
  let state, msg
  if (checkedOut) { state = 'done'; msg = t('today.done_msg', { d: fmtMinutes(att.worked_minutes ?? 0, t) }) }
  else if (checkedIn) {
    state = att.status === 'late' ? 'late' : 'ontime'
    msg = att.status === 'late' ? t('today.late_msg', { n: att.late_minutes }) : t('today.ontime_msg')
    if (nowM > toMin(s.work_end)) msg = t('today.leave_reminder')
  } else if (!today.is_workday) { state = 'off'; msg = today.holiday ? t('checkin.holiday', { name: today.holiday }) : t('checkin.day_off') }
  else if (nowM < ws) { state = 'before'; msg = t('today.starts_in', { d: fmtMinutes(ws - nowM, t) }) }
  else if (nowM <= graceEnd) { state = 'before'; msg = t('today.grace_left', { time: fromMin(graceEnd) }) }
  else if (nowM <= we) {
    state = 'missing'
    // Ikki soatdan oshsa, «8 soat 48 daq kechikyapsiz» o'rniga oddiy eslatma
    msg = nowM - ws > 120 ? t('today.not_yet_long', { time: fromMin(ws) }) : t('today.late_now', { d: fmtMinutes(nowM - ws, t) })
  }
  else { state = 'missing'; msg = t('today.not_checked') }

  const inside = pos && pos.distance != null && pos.distance <= office.radius_m
  const busyLabel = phase === 'locating' ? t('checkin.locating') : phase === 'face' ? t('face.checking') : t('today.sending')

  return (
    <div className={cls('today', embedded && 'today-embedded')}>
      <section className={`hero hero-${state}`}>
        <div className="hero-top">
          <span className="hero-company">{company?.name}</span>
        </div>
        <div className="hero-date">{longDate(today.date, lang)}</div>
        <div className="hero-clock">{clock}</div>
        <div className="hero-msg">{msg}</div>
        <div className="hero-chips">
          {checkedIn && <span className="chip">{t('today.came_at', { time: fmtTime(att.check_in_at, tz) })}</span>}
          {checkedOut && <span className="chip">{t('today.left_at', { time: fmtTime(att.check_out_at, tz) })}</span>}
          {!checkedOut && office.lat != null && (
            pos ? (
              <button className={cls('chip', !inside && 'chip-bad')} onClick={checkLocation}>
                {inside && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
                {inside ? t('today.in_office', { n: Math.round(pos.distance) }) : t('today.far', { d: fmtDist(pos.distance) })}
              </button>
            ) : (
              <button className="chip" onClick={checkLocation}>{t('today.check_location')}</button>
            )
          )}
          {pos && pos.accuracy != null && !checkedOut && <span className="chip">{t('today.gps', { n: Math.round(pos.accuracy) })}</span>}
        </div>
      </section>

      <div className="today-body">
        {office.lat == null && <Alert kind="warn">{t('checkin.no_office')}</Alert>}
        {error && (
          <Alert kind="error" action={action && <Button variant="ghost" size="sm" onClick={() => start(action)}>{t('common.retry')}</Button>}>
            {error}
          </Alert>
        )}
        {!checkedIn && needsFace && <FaceEnroll onDone={load} />}

        <section className="timeline-card">
          <h2>{t('today.timeline')}</h2>
          <DayTimeline
            schedule={s}
            now={checkedOut ? null : clock}
            checkIn={att?.check_in_at ? fmtTime(att.check_in_at, tz) : null}
            checkInLate={att?.status === 'late'}
            checkOut={att?.check_out_at ? fmtTime(att.check_out_at, tz) : null}
          />
        </section>

        {month && (
          <div className="mini-tiles">
            <div className="mini-tile"><span>{t('today.month_label')}</span><b>{month.on_time_days} <small>{t('today.days_ontime')}</small></b></div>
            <div className="mini-tile"><span>{t('today.late_total')}</span><b style={{ color: month.late_minutes ? 'var(--saffron-ink)' : undefined }}>{month.late_minutes} <small>{t('today.minutes')}</small></b></div>
          </div>
        )}
      </div>

      <div className="today-actions">
        {!checkedIn && !needsFace && (
          <>
            <p className="slide-hint">{office.require_selfie ? t('today.hint_selfie') : t('today.hint_gps')}</p>
            <SlideConfirm label={t('today.slide_in')} busyLabel={busyLabel} loading={busy} disabled={office.lat == null} onConfirm={() => start('in')} />
          </>
        )}
        {checkedIn && !checkedOut && (
          <SlideConfirm light label={t('today.slide_out')} busyLabel={busyLabel} loading={busy} onConfirm={() => start('out')} />
        )}
        {checkedOut && <p className="done-note">{t('checkin.day_done')}</p>}
      </div>

      <CameraCapture open={phase === 'camera'} onClose={() => setPhase('idle')} onCapture={(blob) => send('in', pos, blob)} />

      <Modal
        open={Boolean(confirmEarly)}
        onClose={() => setConfirmEarly(null)}
        title={t('checkout.early_title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEarly(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => { const p = confirmEarly; setConfirmEarly(null); send('out', p) }}>{t('checkout.early_confirm')}</Button>
          </>
        }
      >
        <p>{t('checkout.early_text', { time: hhmm(s.work_end) })}</p>
      </Modal>
    </div>
  )
}
