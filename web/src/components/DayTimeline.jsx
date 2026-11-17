import { useI18n } from '../i18n/index.jsx'
import { hhmm } from '../lib/utils.js'

export const toMin = (t) => {
  if (!t) return null
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}
export const fromMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Kun shkalasi: ish vaqti, kechiriladigan daqiqalar, tanaffus, "hozir", kelish/ketish belgilari
export default function DayTimeline({ schedule, now, checkIn, checkInLate, checkOut, legend = true }) {
  const { t } = useI18n()
  const ws = toMin(schedule.work_start) ?? 540
  const we = toMin(schedule.work_end) ?? 1080
  const grace = Number(schedule.grace_minutes) || 0
  const bs = toMin(schedule.break_start)
  const be = toMin(schedule.break_end)
  const pts = [ws - 60, we + 60, toMin(now), toMin(checkIn), toMin(checkOut)].filter((v) => v != null)
  const from = Math.max(0, Math.floor(Math.min(...pts) / 60) * 60)
  const to = Math.min(1440, Math.ceil(Math.max(...pts) / 60) * 60)
  const span = to - from || 1
  const pct = (m) => `${((Math.min(to, Math.max(from, m)) - from) / span) * 100}%`
  const width = (a, b) => `${((Math.min(to, b) - Math.max(from, a)) / span) * 100}%`
  const stepH = span > 14 * 60 ? 3 : 2
  const ticks = []
  for (let m = from; m <= to; m += stepH * 60) ticks.push(m)

  return (
    <div>
      <div className="tl" role="img" aria-label={`${t('today.legend_work', { from: hhmm(schedule.work_start), to: hhmm(schedule.work_end) })}`}>
        <div className="tl-track" />
        <div className="tl-work" style={{ left: pct(ws), width: width(ws, we) }} />
        {grace > 0 && <div className="tl-grace" style={{ left: pct(ws), width: width(ws, ws + grace) }} />}
        {bs != null && be != null && be > bs && <div className="tl-break" style={{ left: pct(bs), width: width(bs, be) }} />}
        {now && <div className="tl-now" style={{ left: pct(toMin(now)) }} />}
        {checkIn && <div className={`tl-mark ${checkInLate ? 'tl-mark-late' : 'tl-mark-in'}`} style={{ left: pct(toMin(checkIn)) }} />}
        {checkOut && <div className="tl-mark tl-mark-out" style={{ left: pct(toMin(checkOut)) }} />}
      </div>
      <div className="tl-axis" aria-hidden="true">
        {ticks.map((m) => <span key={m} style={{ left: pct(m) }}>{String(Math.floor(m / 60)).padStart(2, '0')}</span>)}
      </div>
      {legend && (
        <div className="tl-legend">
          <span><i style={{ background: 'var(--lapis-100)' }} />{t('today.legend_work', { from: hhmm(schedule.work_start), to: hhmm(schedule.work_end) })}</span>
          {grace > 0 && <span><i className="tl-grace" style={{ position: 'static' }} />{t('today.legend_grace', { time: fromMin(ws + grace) })}</span>}
          {bs != null && be != null && be > bs && <span><i style={{ background: '#B9BCCB' }} />{t('today.legend_break')}</span>}
        </div>
      )}
    </div>
  )
}
