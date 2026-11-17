import { useEffect, useState } from 'react'
import { cls } from '../lib/utils.js'

// 24 soatlik vaqt maydoni (iPhone'dagi AM/PM va ramkadan chiqib ketish muammosisiz).
// "930" -> "09:30", "9" -> "09:00", "1805" -> "18:05"
export function normalizeTime(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (!d) return null
  let h, m
  if (d.length <= 2) { h = +d; m = 0 }
  else if (d.length === 3) { h = +d.slice(0, 1); m = +d.slice(1) }
  else { h = +d.slice(0, 2); m = +d.slice(2, 4) }
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function TimeInput({ value, onChange, className, allowEmpty, ...props }) {
  const [text, setText] = useState(value || '')
  useEffect(() => { setText(value || '') }, [value])

  const onInput = (e) => {
    let d = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (d.length >= 3) d = d.slice(0, d.length - 2) + ':' + d.slice(-2)
    setText(d)
  }
  const commit = () => {
    if (!text && allowEmpty) { onChange(''); return }
    const v = normalizeTime(text)
    if (v) { setText(v); if (v !== value) onChange(v) } else setText(value || '')
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="00:00"
      maxLength={5}
      className={cls('time-input', className)}
      value={text}
      onChange={onInput}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}
