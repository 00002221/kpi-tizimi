// Qisqa xarita havolasini ochish (maps.app.goo.gl, go.2gis.com, yandex.uz/maps/-/…).
// Brauzer boshqa saytga so'rov yubora olmaydi (CORS), shuning uchun yo'naltirishlarni shu yerda kuzatamiz.
// Natija: { url: oxirgi manzil, hints: [koordinata bo'lishi mumkin bo'lgan qatorlar] } — ajratishni ilova o'zi qiladi.
// Faqat tizimga kirgan foydalanuvchi (verify_jwt) va faqat xarita saytlari — ochiq proksi emas.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ALLOWED = /(^|\.)(goo\.gl|g\.co|google\.(com(\.[a-z]{2})?|co\.[a-z]{2}|[a-z]{2})|2gis\.(uz|ru|kz|com)|yandex\.(uz|ru|com|kz|by)|openstreetmap\.org|apple\.com)$/i

function allowed(u: URL) {
  return (u.protocol === 'https:' || u.protocol === 'http:') && ALLOWED.test(u.hostname)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)
  const { url } = await req.json().catch(() => ({}))
  let cur: URL
  try { cur = new URL(String(url)) } catch { return reply({ error: 'bad_url' }, 400) }
  if (!allowed(cur)) return reply({ error: 'not_map' }, 400)

  const hints: string[] = []
  for (let i = 0; i < 6; i++) {
    let res: Response
    try {
      res = await fetch(cur, {
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', 'Accept-Language': 'uz,ru;q=0.8,en;q=0.6' },
      })
    } catch {
      return reply({ error: 'fetch' }, 502)
    }
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel()
      let next: URL
      try { next = new URL(loc, cur) } catch { break }
      // Google rozilik sahifasi asl manzilni «continue» ichida saqlaydi
      const cont = next.hostname.startsWith('consent.') ? next.searchParams.get('continue') : null
      if (cont) { try { next = new URL(cont) } catch { /* qoldiramiz */ } }
      if (!allowed(next)) return reply({ url: next.href, hints })
      cur = next
      continue
    }
    // Oxirgi sahifa: HTML ichidan koordinata bo'lishi mumkin bo'lgan joylarni olamiz
    const type = res.headers.get('content-type') || ''
    if (type.includes('text/html')) {
      const html = (await res.text()).slice(0, 600_000)
      const pats = [
        /https?:\/\/[^"'\s]*(?:center|markers|ll)=[-\d.]+(?:%2C|,)[-\d.]+[^"'\s]*/gi,
        /@-?\d{1,2}\.\d{3,},-?\d{1,3}\.\d{3,}/g,
        /!3d-?\d{1,2}\.\d{3,}!4d-?\d{1,3}\.\d{3,}/g,
      ]
      for (const p of pats) for (const m of html.match(p)?.slice(0, 3) ?? []) hints.push(m.replace(/&amp;/g, '&'))
      // Yandex tashkilot sahifasi: "coordinates":[uzunlik,kenglik]
      const y = html.match(/"coordinates":\[(-?\d{1,3}\.\d+),(-?\d{1,2}\.\d+)\]/)
      if (y) hints.push(`${y[2]}, ${y[1]}`)
    } else {
      await res.body?.cancel()
    }
    break
  }
  return reply({ url: cur.href, hints })
})
