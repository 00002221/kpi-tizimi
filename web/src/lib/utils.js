// ---------- Sana va vaqt (kompaniya vaqt mintaqasida) ----------

export function todayIn(tz = 'Asia/Tashkent') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function nowTimeIn(tz = 'Asia/Tashkent', withSeconds = false) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}), hourCycle: 'h23',
  }).format(new Date())
}

export function fmtTime(ts, tz = 'Asia/Tashkent') {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ts))
}

// "09:00:00" -> "09:00"
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '—')

export function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${day}.${m}.${y}`
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const monthStart = (dateStr) => dateStr.slice(0, 7) + '-01'

export function monthEnd(dateStr) {
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export const daysInMonth = (dateStr) => Number(monthEnd(dateStr).slice(8, 10))

// ISO hafta kuni: 1 = dushanba ... 7 = yakshanba
export function isoDow(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z').getUTCDay()
  return d === 0 ? 7 : d
}

export function fmtMinutes(min, t) {
  if (min == null) return '—'
  const h = Math.floor(min / 60), m = min % 60
  if (!h) return t('unit.min', { n: m })
  return t('unit.hmin', { h, m })
}

// ---------- Raqamlar ----------

export function fmtNum(n, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const fixed = Number(n).toFixed(digits)
  const [int, frac] = fixed.split('.')
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (frac ? ',' + frac : '')
}

export const fmtMoney = (n, cur = 'UZS') => (n == null ? '—' : `${fmtNum(n)} ${cur}`)

// ---------- Geolokatsiya ----------

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('GEO_UNSUPPORTED'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (e) => reject(new Error(e.code === 1 ? 'GEO_DENIED' : e.code === 3 ? 'GEO_TIMEOUT' : 'GEO_UNAVAILABLE')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

export function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Ofisga nisbatan siljish (metrda): x — sharq, y — shimol
export function offsetM(fromLat, fromLng, toLat, toLng) {
  return {
    x: (toLng - fromLng) * 111320 * Math.cos((fromLat * Math.PI) / 180),
    y: (toLat - fromLat) * 110540,
  }
}

// ---------- Xatolar ----------

const AUTH_ERRORS = {
  'Invalid login credentials': 'INVALID_LOGIN',
  'User already registered': 'USER_EXISTS',
  'Email not confirmed': 'EMAIL_NOT_CONFIRMED',
}

export function errorText(err, t) {
  if (!err) return ''
  const raw = err.message || String(err)
  const code = AUTH_ERRORS[raw] || raw
  if (/Password should be at least/i.test(raw)) return t('err.WEAK_PASSWORD')
  if (/rate limit/i.test(raw)) return t('err.RATE_LIMIT')
  if (/Failed to fetch|NetworkError/i.test(raw)) return t('err.NETWORK')
  // Sayt yangilangan, baza hali eski: funksiya yoki jadval topilmadi
  if (err.code === 'PGRST202' || err.code === 'PGRST205' || err.code === '42883' || /schema cache|Could not find the function/i.test(raw)) {
    return t('err.UPDATING')
  }
  const key = 'err.' + code
  const txt = t(key, { n: err.hint ?? '' })
  if (txt !== key) return txt
  // O'zimizning tushunarli kodlarimiz (KATTA_HARF) — o'z holicha; texnik inglizcha matn — umumiy xabar
  if (/^[A-Z_]+$/.test(raw)) return raw
  return t('err.UNKNOWN', { code: err.code || err.status || '—' })
}

export function cls(...a) {
  return a.filter(Boolean).join(' ')
}
