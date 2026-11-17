import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useI18n, LANGS } from '../i18n/index.jsx'
import { cls } from '../lib/utils.js'

export function Button({ variant = 'primary', size, loading, className, children, ...props }) {
  return (
    <button
      className={cls('btn', `btn-${variant}`, size && `btn-${size}`, className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <span className="spinner spinner-sm" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cls('field', className)}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  )
}

export function Spinner({ label }) {
  return (
    <div className="center-block" role="status">
      <span className="spinner" aria-hidden="true" />
      {label && <span className="muted">{label}</span>}
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  )
}

export function Alert({ kind = 'info', children, action }) {
  return (
    <div className={cls('alert', `alert-${kind}`)} role={kind === 'error' ? 'alert' : undefined}>
      <div>{children}</div>
      {action}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cls('modal', wide && 'modal-wide')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="×">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          className={cls('tab', value === it.value && 'tab-active')}
          onClick={() => onChange(it.value)}
        >
          {it.label}
          {it.count ? <span className="tab-count">{it.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

const STATUS_ICON = { present: '✓', late: '!', absent: '✕', excused: 'S', not_yet: '…', off: '', holiday: '★', future: '' }

export function StatusBadge({ status, minutes }) {
  const { t } = useI18n()
  return (
    <span className={cls('badge', `st-${status}`)}>
      <span className="badge-icon" aria-hidden="true">{STATUS_ICON[status]}</span>
      {t('status.' + status)}
      {status === 'late' && minutes ? ` ${t('unit.min', { n: minutes })}` : ''}
    </span>
  )
}

export function LangSwitch({ dark }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={cls('lang-switch', dark && 'lang-switch-dark')} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.code} aria-pressed={lang === l.code} onClick={() => setLang(l.code)} title={l.label}>
          {l.short}
        </button>
      ))}
    </div>
  )
}

// ---------- Toast ----------
const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setItems((xs) => [...xs, { id, text, kind }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((x) => <div key={x.id} className={cls('toast', `toast-${x.kind}`)}>{x.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

// ---------- Tasdiqlash oynasi (brauzerning confirm() o'rniga — telefonlarda ham ishlaydi) ----------
const ConfirmCtx = createContext(() => Promise.resolve(false))

export function ConfirmProvider({ children }) {
  const { t } = useI18n()
  const [state, setState] = useState(null) // { text, danger, resolve }
  const ask = useCallback((text, { danger = true } = {}) => new Promise((resolve) => setState({ text, danger, resolve })), [])
  const close = (v) => { state?.resolve(v); setState(null) }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={t('common.confirm_title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>{t('common.cancel')}</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{t('common.confirm_yes')}</Button>
          </>
        }
      >
        <p>{state?.text}</p>
      </Modal>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)

// Yuz tekshiruvi natijasi
export function FaceBadge({ status, distance }) {
  const { t } = useI18n()
  if (!status) return null
  const pct = distance == null ? null : Math.max(0, Math.round((1 - distance) * 100))
  const cls_ = status === 'match' ? 'face-ok' : 'face-bad'
  return (
    <span className={cls('badge', cls_)} title={pct != null ? t('face.similarity', { n: pct }) : undefined}>
      <span className="badge-icon" aria-hidden="true">{status === 'match' ? '☺' : '⚠'}</span>
      {t('face.' + status)}{pct != null ? ` ${pct}%` : ''}
    </span>
  )
}
