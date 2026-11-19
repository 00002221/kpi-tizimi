// Joylashuvni matndan ajratib olish: koordinatalar, xarita havolalari (Google, Yandex, 2GIS, Apple, OSM), geo: URI.
// Natija: { lat, lng } | { short: url } (qisqa havola — serverda ochiladi) | null

const num = (s) => Number(String(s).replace(',', '.'))
export const validLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)

const ok = (lat, lng) => {
  const a = num(lat), b = num(lng)
  return validLatLng(a, b) ? { lat: +a.toFixed(6), lng: +b.toFixed(6) } : null
}

const N = '(-?\\d{1,3}(?:[.,]\\d+)?)'
const PAIR = new RegExp(`^\\s*${N}\\s*[,;\\s]\\s*${N}\\s*$`)

const SHORT_HOSTS = /(^|\.)(goo\.gl|g\.co|google\.(?:com|ru|uz|kz|co\.uz|com\.[a-z]{2})|2gis\.(?:uz|ru|kz|com)|yandex\.(?:uz|ru|com|kz|by))$/i

export function parseLocation(raw) {
  const text = String(raw || '').trim()
  if (!text) return null

  // 1) Faqat ikki son: «41.311081, 69.279737»
  const p = text.match(PAIR)
  if (p) return ok(p[1], p[2])

  // 2) Havola matn ichida bo'lishi mumkin (Telegram'dan nusxa)
  const urlMatch = text.match(/(https?:\/\/[^\s<>"']+|geo:[^\s<>"']+)/i)
  const s = urlMatch ? urlMatch[1] : text
  let dec = s
  try { dec = decodeURIComponent(s) } catch { /* buzilgan % — o'zicha qoladi */ }

  // geo:41.3,69.2
  let m = dec.match(new RegExp(`^geo:${N},${N}`, 'i'))
  if (m) return ok(m[1], m[2])

  let host = ''
  try { host = new URL(s).hostname.replace(/^www\./, '') } catch { /* havola emas */ }
  const isYandex = /yandex\./i.test(host)
  const is2gis = /2gis\./i.test(host)

  // Yandex va 2GIS'da tartib: uzunlik, kenglik
  if (isYandex) {
    m = dec.match(new RegExp(`[?&](?:pt|whatshere\\[point\\])=${N},${N}`)) || dec.match(new RegExp(`[?&]ll=${N},${N}`))
    if (m) return ok(m[2], m[1])
  }
  if (is2gis) {
    m = dec.match(new RegExp(`/geo/${N},${N}`)) || dec.match(new RegExp(`[?&]m=${N},${N}`))
    if (m) return ok(m[2], m[1])
  }

  // Google: joy nuqtasi (!3d…!4d…) xarita markazidan (@…) aniqroq
  m = dec.match(new RegExp(`!3d${N}!4d${N}`))
  if (m) return ok(m[1], m[2])
  m = dec.match(new RegExp(`[?&](?:q|query|ll|sll|daddr|destination|coordinate|center)=(?:loc:)?${N}\\s*,\\s*${N}`))
  if (m) return ok(m[1], m[2])
  m = dec.match(new RegExp(`@${N},${N}`))
  if (m) return ok(m[1], m[2])

  // OpenStreetMap
  m = dec.match(new RegExp(`mlat=${N}&mlon=${N}`)) || dec.match(new RegExp(`#map=\\d+/${N}/${N}`))
  if (m) return ok(m[1], m[2])

  // Qisqa havola yoki koordinatasiz xarita sahifasi — serverda ochamiz
  if (host && SHORT_HOSTS.test(host)) return { short: s }

  return null
}
