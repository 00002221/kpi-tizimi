// Barcha t('kalit') larni topib, 3 tilda mavjudligini tekshiradi: npm run check-i18n
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const files = []
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.jsx?$/.test(f) && files.push(p) })
walk('src')
const keys = new Set()
for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-z_]+\.[A-Za-z0-9_.]+)'/g)) keys.add(m[1])
const dynamic = {
  status: ['present', 'late', 'absent', 'excused', 'not_yet', 'off', 'holiday', 'future'],
  task: ['todo', 'in_progress', 'done'],
  role: ['admin', 'employee'],
  face: ['match', 'mismatch', 'no_face'],
  err: ['OUT_OF_RANGE', 'LOW_ACCURACY', 'FACE_NOT_ENROLLED', 'FACE_NOT_FOUND', 'FACE_ALREADY_ENROLLED', 'FACE_CONSENT_REQUIRED', 'FACE_MODEL', 'SELFIE_REQUIRED', 'SELFIE_INVALID', 'ALREADY_CHECKED_IN', 'NOT_CHECKED_IN', 'ALREADY_CHECKED_OUT',
    'NO_OFFICE_LOCATION', 'BAD_LOCATION', 'NOT_MEMBER', 'NOT_ACTIVE', 'FORBIDDEN', 'INVALID_CODE', 'ALREADY_MEMBER', 'LAST_ADMIN',
    'NOT_AUTHENTICATED', 'GEO_DENIED', 'GEO_TIMEOUT', 'GEO_UNAVAILABLE', 'GEO_UNSUPPORTED', 'INVALID_LOGIN', 'USER_EXISTS',
    'EMAIL_NOT_CONFIRMED', 'WEAK_PASSWORD', 'RATE_LIMIT', 'NETWORK', 'RANGE_TOO_LARGE', 'BAD_STATUS', 'USE_PROFILE', 'NOT_FOUND', 'CHECKOUT_BEFORE_CHECKIN', 'OWN_COMPANY'],
}
for (const [p, list] of Object.entries(dynamic)) list.forEach((k) => keys.add(`${p}.${k}`))
let bad = 0
for (const lang of ['uz', 'ru', 'en']) {
  const dict = (await import(`../src/i18n/${lang}.js`)).default
  const missing = [...keys].filter((k) => !(k in dict))
  const extra = Object.keys(dict).filter((k) => !keys.has(k))
  if (missing.length) { bad++; console.log(`[${lang}] yo'q:`, missing.join(', ')) }
  if (extra.length) console.log(`[${lang}] ortiqcha:`, extra.join(', '))
}
console.log(bad ? 'XATO' : `OK — ${keys.size} ta kalit`)
process.exit(bad ? 1 : 0)
