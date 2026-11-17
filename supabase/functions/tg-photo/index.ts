// Telegram'ga rasmli xabar: bazadagi tg_outbox navbatidan bitta xabarni olib, selfi(lar)ni
// yopiq «selfies» omboridan yuklab, kompaniyaning Telegram guruhiga yuboradi.
// Chaqiruvchi: baza (tg_send_photo → pg_net). Ruxsat: xabarning maxfiy tokeni + bir martalik yuborish.
import { createClient } from 'npm:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
try {
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
  if (keys.default) key = keys.default
} catch { /* eski kalitlar */ }
const db = createClient(url, key, { auth: { persistSession: false } })

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function mark(id: number, result: string) {
  await db.from('tg_outbox').update({ result }).eq('id', id)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'method' }, 405)
  const { id, token } = await req.json().catch(() => ({}))
  if (!id || typeof token !== 'string') return reply({ error: 'bad_request' }, 400)

  // Xabarni egallash: faqat token mos va hali yuborilmagan bo'lsa (qayta yuborib bo'lmaydi)
  const { data: claimed, error } = await db.from('tg_outbox')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', id).eq('token', token).is('sent_at', null)
    .select('id, company_id, caption, photo_paths')
  if (error) return reply({ error: 'db' }, 500)
  const m = claimed?.[0]
  if (!m) return reply({ error: 'not_found' }, 404)

  const { data: tg } = await db.from('company_telegram')
    .select('bot_token, chat_id, enabled').eq('company_id', m.company_id).maybeSingle()
  if (!tg?.enabled || !tg.bot_token || !tg.chat_id) {
    await mark(m.id, 'disabled')
    return reply({ ok: false })
  }
  const api = (method: string) => `https://api.telegram.org/bot${tg.bot_token}/${method}`
  const sendText = () => fetch(api('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tg.chat_id, text: m.caption }),
  })

  const photos: Blob[] = []
  for (const path of m.photo_paths ?? []) {
    const { data } = await db.storage.from('selfies').download(path)
    if (data) photos.push(data)
  }

  let res: Response
  if (photos.length === 0) {
    res = await sendText()
  } else if (photos.length === 1) {
    const fd = new FormData()
    fd.append('chat_id', tg.chat_id)
    fd.append('caption', m.caption)
    fd.append('photo', photos[0], 'selfie.jpg')
    res = await fetch(api('sendPhoto'), { method: 'POST', body: fd })
  } else {
    // Bir nechta rasm (namuna + bugungi selfi) — albom, izoh birinchi rasmda
    const fd = new FormData()
    fd.append('chat_id', tg.chat_id)
    fd.append('media', JSON.stringify(photos.map((_, i) => ({
      type: 'photo', media: `attach://p${i}`, ...(i === 0 ? { caption: m.caption } : {}),
    }))))
    photos.forEach((b, i) => fd.append(`p${i}`, b, `p${i}.jpg`))
    res = await fetch(api('sendMediaGroup'), { method: 'POST', body: fd })
  }

  const out = await res.json().catch(() => ({ ok: false }))
  if (!out.ok && photos.length) await sendText() // rasm o'tmasa ham xabar yo'qolmasin
  await mark(m.id, out.ok ? `ok:${photos.length}` : `error:${String(out.description ?? res.status).slice(0, 200)}`)
  return reply({ ok: Boolean(out.ok) })
})
