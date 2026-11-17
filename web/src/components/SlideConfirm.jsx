import { useEffect, useRef, useState } from 'react'
import { cls } from '../lib/utils.js'

const KNOB = 56
const PAD = 6

// "Surib tasdiqlash" — tasodifiy bosishdan himoya. Klaviatura va ekran o'quvchi uchun oddiy bosish ham ishlaydi.
export default function SlideConfirm({ label, busyLabel, onConfirm, disabled, loading, light }) {
  const ref = useRef(null)
  const startX = useRef(null)
  const [x, setX] = useState(0)
  const [anim, setAnim] = useState(false)

  useEffect(() => { if (!loading) { setAnim(true); setX(0) } }, [loading])

  const max = () => Math.max(0, (ref.current?.clientWidth || 300) - KNOB - PAD * 2)

  const down = (e) => {
    if (disabled || loading) return
    startX.current = e.clientX - x
    setAnim(false)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    if (startX.current == null) return
    setX(Math.min(max(), Math.max(0, e.clientX - startX.current)))
  }
  const up = () => {
    if (startX.current == null) return
    startX.current = null
    setAnim(true)
    if (x >= max() * 0.82) { setX(max()); onConfirm?.() } else setX(0)
  }
  // Klaviatura (Enter/Probel) yoki VoiceOver orqali faollashtirish: e.detail === 0
  const click = (e) => { if (e.detail === 0 && !disabled && !loading) onConfirm?.() }

  return (
    <button
      ref={ref}
      type="button"
      className={cls('slide', light && 'slide-light', anim && 'slide-anim')}
      disabled={disabled}
      aria-busy={loading || undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={click}
    >
      <span className="slide-fill" style={{ width: x + KNOB + PAD * 2 }} />
      <span className="slide-label">{loading ? busyLabel || label : label}</span>
      <span className="slide-knob" style={{ transform: `translateX(${x}px)` }} aria-hidden="true">
        {loading ? (
          <span className="spinner spinner-sm" style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }} />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        )}
      </span>
    </button>
  )
}
