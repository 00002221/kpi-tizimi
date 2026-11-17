import { useI18n } from '../i18n/index.jsx'
import { cls, isoDow } from '../lib/utils.js'

// Bitta ishchining oy kalendari (attendance_grid qatorlaridan)
export default function MonthCalendar({ rows }) {
  const { t } = useI18n()
  if (!rows.length) return null
  const lead = isoDow(rows[0].day) - 1
  const weekdays = t('cal.weekdays').split(',')
  return (
    <div className="calendar">
      <div className="cal-grid">
        {weekdays.map((w) => <div key={w} className="cal-wd">{w}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={'e' + i} />)}
        {rows.map((r) => (
          <div
            key={r.day}
            className={cls('cal-day', `st-${r.status}`)}
            title={t('status.' + r.status) + (r.status === 'late' ? ` (${t('unit.min', { n: r.late_minutes })})` : '')}
          >
            {Number(r.day.slice(8, 10))}
          </div>
        ))}
      </div>
      <div className="legend">
        {['present', 'late', 'absent', 'excused', 'off'].map((s) => (
          <span key={s} className="legend-item"><i className={cls('legend-sw', `st-${s}`)} />{t('status.' + s)}</span>
        ))}
      </div>
    </div>
  )
}
