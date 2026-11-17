import { useI18n } from '../i18n/index.jsx'
import { addDays, fmtDate } from '../lib/utils.js'

// Telefon tilidan qat'i nazar, oy va sana ilova tilida ko'rinadi ("Noyabr 2026", "17.11.2026")
const MONTHS = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}

export function monthLabel(ym, lang) {
  const [y, m] = ym.split('-').map(Number)
  return `${(MONTHS[lang] || MONTHS.uz)[m - 1]} ${y}`
}

function shiftMonth(ym, n) {
  let [y, m] = ym.split('-').map(Number)
  m += n
  while (m < 1) { m += 12; y -= 1 }
  while (m > 12) { m -= 12; y += 1 }
  return `${y}-${String(m).padStart(2, '0')}`
}

const Arrow = ({ dir }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
)

// Oy tanlash: ‹ Noyabr 2026 ›
export function MonthPicker({ value, onChange, max, label }) {
  const { t, lang } = useI18n()
  const next = shiftMonth(value, 1)
  return (
    <div className="dpick" role="group" aria-label={label || t('common.month')}>
      <button type="button" className="dpick-arrow" onClick={() => onChange(shiftMonth(value, -1))} aria-label={t('common.prev')}><Arrow dir={-1} /></button>
      <span className="dpick-value" aria-live="polite">{monthLabel(value, lang)}</span>
      <button type="button" className="dpick-arrow" onClick={() => onChange(next)} disabled={Boolean(max) && next > max} aria-label={t('common.next')}><Arrow dir={1} /></button>
    </div>
  )
}

// Kun tanlash: ‹ 17.11.2026 › — o'rtasini bosilsa, telefonning kalendari ochiladi
export function DayPicker({ value, onChange, max, label }) {
  const { t } = useI18n()
  const next = addDays(value, 1)
  return (
    <div className="dpick" role="group" aria-label={label || t('common.date')}>
      <button type="button" className="dpick-arrow" onClick={() => onChange(addDays(value, -1))} aria-label={t('common.prev')}><Arrow dir={-1} /></button>
      <span className="dpick-value dpick-open">
        {fmtDate(value)}
        <input type="date" value={value} max={max} aria-label={label || t('common.date')}
          onClick={(e) => { try { e.currentTarget.showPicker?.() } catch { /* eski brauzer */ } }}
          onChange={(e) => e.target.value && onChange(e.target.value)} />
      </span>
      <button type="button" className="dpick-arrow" onClick={() => onChange(next)} disabled={Boolean(max) && next > max} aria-label={t('common.next')}><Arrow dir={1} /></button>
    </div>
  )
}
