import { useState } from 'react'
import { supabase } from '../supabase.js'
import { useI18n } from '../i18n/index.jsx'
import { Button } from './ui.jsx'
import { parseLocation } from '../lib/geo.js'

// Bitta maydon: xarita havolasi (Google, Yandex, 2GIS…), koordinata yoki manzil.
// Havola/koordinata darhol nuqtaga aylanadi; oddiy matn — OpenStreetMap'dan qidiriladi.
export default function LocationFinder({ onPick }) {
  const { t, lang } = useI18n()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [results, setResults] = useState([])

  const pick = (lat, lng, label) => {
    onPick(lat, lng)
    setResults([])
    setMsg({ ok: true, text: label ? t('loc.found_place', { name: label }) : t('loc.found') })
  }

  const fromShort = async (url) => {
    const { data, error } = await supabase.functions.invoke('map-link', { body: { url } })
    if (error || !data) return null
    for (const s of [data.url, ...(data.hints || [])]) {
      const r = parseLocation(s)
      if (r && r.lat != null) return r
    }
    return null
  }

  const search = async (text) => {
    const u = new URL('https://nominatim.openstreetmap.org/search')
    u.search = new URLSearchParams({ format: 'jsonv2', q: text, limit: '5', 'accept-language': `${lang},ru,en` })
    const res = await fetch(u)
    if (!res.ok) throw new Error('search')
    const list = await res.json()
    return list.map((x) => ({ lat: +(+x.lat).toFixed(6), lng: +(+x.lon).toFixed(6), name: x.display_name }))
  }

  const run = async (raw = q) => {
    const text = raw.trim()
    if (!text) return
    setMsg(null)
    setResults([])
    const r = parseLocation(text)
    if (r && r.lat != null) return pick(r.lat, r.lng)
    setBusy(true)
    try {
      if (r?.short) {
        const s = await fromShort(r.short)
        if (s) pick(s.lat, s.lng)
        else setMsg({ ok: false, text: t('loc.link_no_coords') })
      } else if (/^https?:\/\//i.test(text)) {
        setMsg({ ok: false, text: t('loc.link_no_coords') })
      } else {
        const list = await search(text)
        if (!list.length) setMsg({ ok: false, text: t('loc.not_found') })
        else if (list.length === 1) pick(list[0].lat, list[0].lng, list[0].name)
        else setResults(list)
      }
    } catch {
      setMsg({ ok: false, text: t('loc.error') })
    }
    setBusy(false)
  }

  return (
    <div className="loc-finder">
      <label className="field-label" htmlFor="loc-q">{t('loc.label')}</label>
      <form className="loc-row" onSubmit={(e) => { e.preventDefault(); run() }}>
        <input
          id="loc-q" value={q} placeholder={t('loc.placeholder')} autoComplete="off"
          onChange={(e) => setQ(e.target.value)}
          onPaste={(e) => {
            const v = e.clipboardData.getData('text')
            if (v && parseLocation(v)) { e.preventDefault(); setQ(v); run(v) }
          }}
        />
        <Button type="submit" variant="secondary" loading={busy}>{t('loc.find')}</Button>
      </form>
      <p className="muted small">{t('loc.hint')}</p>
      {msg && <p className={'small ' + (msg.ok ? 'loc-ok' : 'loc-err')} role="status">{msg.text}</p>}
      {results.length > 0 && (
        <ul className="loc-results">
          {results.map((r) => (
            <li key={r.lat + ',' + r.lng}>
              <button type="button" onClick={() => pick(r.lat, r.lng, r.name)}>{r.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
