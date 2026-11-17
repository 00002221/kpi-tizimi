import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Modal, Spinner, StatusBadge, useToast } from '../../components/ui.jsx'
import CameraCapture from '../../components/CameraCapture.jsx'
import FaceEnroll from '../../components/FaceEnroll.jsx'
import { faceDescriptor, loadFaceModels } from '../../lib/face.js'
import { distanceM, errorText, fmtDate, fmtMinutes, fmtTime, getPosition, hhmm, nowTimeIn, offsetM } from '../../lib/utils.js'

// Ishxona hududi: markazda ofis, aylana — ruxsat etilgan radius, nuqta — siz
function GeoRing({ office, pos, state, label }) {
  const C = 150, R = 104, MAX = 134
  let dot = null
  if (pos && office?.lat != null) {
    const o = offsetM(office.lat, office.lng, pos.latitude, pos.longitude)
    let x = (o.x / office.radius_m) * R, y = (-o.y / office.radius_m) * R
    const len = Math.hypot(x, y)
    if (len > MAX) { x = (x / len) * MAX; y = (y / len) * MAX }
    dot = { x: C + x, y: C + y, inside: pos.distance <= office.radius_m }
  }
  return (
    <div className={`ring ring-${state}`}>
      <svg viewBox="0 0 300 300" aria-hidden="true">
        <circle cx={C} cy={C} r={MAX + 8} className="ring-outer" />
        <circle cx={C} cy={C} r={R} className="ring-zone" />
        <circle cx={C} cy={C} r={R} className="ring-edge" />
        {state === 'locating' && <circle cx={C} cy={C} r={R} className="ring-pulse" />}
        <circle cx={C} cy={C} r="6" className="ring-office" />
        <text x={C} y={C + 24} textAnchor="middle" className="ring-label">{label}</text>
        {dot && (
          <>
            <line x1={C} y1={C} x2={dot.x} y2={dot.y} className={dot.inside ? 'ring-line' : 'ring-line ring-line-out'} />
            <circle cx={dot.x} cy={dot.y} r="11" className={dot.inside ? 'ring-me' : 'ring-me ring-me-out'} />
          </>
        )}
      </svg>
    </div>
  )
}

export default function CheckIn() {
  const { t } = useI18n()
  const { member, company } = useAuth()
  const toast = useToast()
  const tz = company?.timezone || 'Asia/Tashkent'
  const [today, setToday] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [clock, setClock] = useState(nowTimeIn(tz))
  const [phase, setPhase] = useState('idle') // idle | locating | camera | sending
  const [action, setAction] = useState(null) // 'in' | 'out'
  const [pos, setPos] = useState(null)
  const [error, setError] = useState(null)
  const [confirmEarly, setConfirmEarly] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_today')
    if (error) setLoadErr(errorText(error, t))
    else { setToday(data); setLoadErr(null) }
  }, [t])

  useEffect(() => { load() }, [load])
  const faceRequired = Boolean(today?.face?.required)
  useEffect(() => { if (faceRequired) loadFaceModels().catch(() => {}) }, [faceRequired])
  useEffect(() => {
    const id = setInterval(() => setClock(nowTimeIn(tz)), 1000 * 15)
    return () => clearInterval(id)
  }, [tz])

  if (loadErr) return <Alert kind="error">{loadErr}</Alert>
  if (!today) return <Spinner />

  const office = today.office
  const att = today.attendance
  const s = today.schedule
  const checkedIn = Boolean(att?.check_in_at)
  const checkedOut = Boolean(att?.check_out_at)

  const locate = async () => {
    const c = await getPosition()
    const p = { latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy }
    p.distance = office.lat != null ? distanceM(office.lat, office.lng, p.latitude, p.longitude) : null
    setPos(p)
    return p
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
      // Erta ketishni tasdiqlash
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

  const ringState = phase === 'locating' ? 'locating'
    : error && pos && pos.distance > office.radius_m ? 'out'
    : checkedOut ? 'done' : checkedIn ? 'in' : 'idle'

  return (
    <div className="checkin">
      <div className="checkin-head">
        <div>
          <p className="muted">{fmtDate(today.date)}</p>
          <h1>{t('checkin.hello', { name: member.full_name.split(' ')[0] })}</h1>
        </div>
        <span className="checkin-clock">{clock}</span>
      </div>

      {office.lat == null && <Alert kind="warn">{t('checkin.no_office')}</Alert>}

      <GeoRing office={office} pos={pos} state={ringState} label={t('checkin.office')} />

      <div className="checkin-status">
        {!today.is_workday && !checkedIn && (
          <p className="muted">{today.holiday ? t('checkin.holiday', { name: today.holiday }) : t('checkin.day_off')}</p>
        )}
        {today.is_workday && !checkedIn && (
          <p>{t('checkin.starts_at', { time: hhmm(s.work_start), grace: s.grace_minutes })}</p>
        )}
        {checkedIn && (
          <div className="checkin-facts">
            <div><span className="muted">{t('checkin.came')}</span><b>{fmtTime(att.check_in_at, tz)}</b></div>
            <div><span className="muted">{t('checkin.left')}</span><b>{checkedOut ? fmtTime(att.check_out_at, tz) : '—'}</b></div>
            <div><span className="muted">{t('checkin.status')}</span><StatusBadge status={att.status} minutes={att.late_minutes} /></div>
            {checkedOut && <div><span className="muted">{t('checkin.worked')}</span><b>{fmtMinutes(att.worked_minutes, t)}</b></div>}
          </div>
        )}
        {pos && (
          <p className="muted small">
            {t('checkin.distance', { n: Math.round(pos.distance ?? 0), r: office.radius_m })}
            {pos.accuracy ? ` (±${Math.round(pos.accuracy)} m)` : ''}
          </p>
        )}
      </div>

      {error && (
        <Alert kind="error" action={<Button variant="ghost" size="sm" onClick={() => start(action)}>{t('common.retry')}</Button>}>
          {error}
        </Alert>
      )}

      {!checkedIn && today.face?.required && !today.face.enrolled && <FaceEnroll onDone={load} />}

      <div className="checkin-actions">
        {!checkedIn && !(today.face?.required && !today.face.enrolled) && (
          <Button size="xl" onClick={() => start('in')} loading={['locating', 'face', 'sending'].includes(phase)} disabled={office.lat == null}>
            {phase === 'locating' ? t('checkin.locating') : phase === 'face' ? t('face.checking') : t('checkin.btn_in')}
          </Button>
        )}
        {checkedIn && !checkedOut && (
          <Button size="xl" variant="secondary" onClick={() => start('out')} loading={phase === 'locating' || phase === 'sending'}>
            {phase === 'locating' ? t('checkin.locating') : t('checkin.btn_out')}
          </Button>
        )}
        {checkedOut && <p className="done-note">{t('checkin.day_done')}</p>}
      </div>

      <dl className="schedule-strip">
        <div><dt>{t('sched.work')}</dt><dd>{hhmm(s.work_start)}–{hhmm(s.work_end)}</dd></div>
        {s.break_start && s.break_end && <div><dt>{t('sched.break')}</dt><dd>{hhmm(s.break_start)}–{hhmm(s.break_end)}</dd></div>}
        <div><dt>{t('sched.grace')}</dt><dd>{t('unit.min', { n: s.grace_minutes })}</dd></div>
      </dl>

      <CameraCapture
        open={phase === 'camera'}
        onClose={() => setPhase('idle')}
        onCapture={(blob) => send('in', pos, blob)}
      />

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
