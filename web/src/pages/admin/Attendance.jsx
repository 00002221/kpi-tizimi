import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Empty, FaceBadge, Field, Modal, PageHeader, Spinner, StatusBadge, Tabs, useToast, useConfirm } from '../../components/ui.jsx'
import { exportXlsx } from '../../lib/excel.js'
import { fromMin, toMin } from '../../components/DayTimeline.jsx'
import TimeInput from '../../components/TimeInput.jsx'
import { cls, errorText, fmtDate, fmtMinutes, fmtTime, todayIn } from '../../lib/utils.js'
import { MonthPicker, DayPicker } from '../../components/DatePickers.jsx'

export default function Attendance() {
  const { t } = useI18n()
  const [tab, setTab] = useState('daily')
  return (
    <div className="stack-lg">
      <PageHeader title={t('nav.attendance')} />
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'daily', label: t('att.daily') },
        { value: 'monthly', label: t('att.monthly') },
      ]} />
      {tab === 'daily' ? <Daily /> : <Monthly />}
    </div>
  )
}

const ORDER = { late: 0, absent: 1, not_yet: 2, present: 3, excused: 4, holiday: 5, off: 6, future: 7 }

function Daily() {
  const { t } = useI18n()
  const { company } = useAuth()
  const tz = company.timezone
  const today = todayIn(tz)
  const [date, setDate] = useState(today)
  const [rows, setRows] = useState(null)
  const [urls, setUrls] = useState({})
  const [refs, setRefs] = useState({}) // member_id -> yuz namunasi rasmi
  const [error, setError] = useState(null)
  const [edit, setEdit] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [grace, setGrace] = useState({}) // member_id -> kechikish chegarasi (daqiqa)

  useEffect(() => {
    supabase.from('member_schedule').select('member_id, grace_minutes').eq('company_id', company.id)
      .then(({ data }) => setGrace(Object.fromEntries((data || []).map((g) => [g.member_id, g.grace_minutes || 0]))))
  }, [company.id])

  const load = useCallback(async () => {
    setRows(null)
    const { data, error } = await supabase.rpc('attendance_grid', { p_from: date, p_to: date })
    if (error) { setError(errorText(error, t)); setRows([]); return }
    setError(null)
    const sorted = [...data].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.full_name.localeCompare(b.full_name))
    setRows(sorted)
    const { data: profiles } = await supabase.from('face_profiles').select('member_id, photo_path').eq('company_id', company.id)
    setRefs(Object.fromEntries((profiles || []).map((p) => [p.member_id, p.photo_path])))
    const paths = [...sorted.map((r) => r.check_in_selfie), ...(profiles || []).map((p) => p.photo_path)].filter(Boolean)
    if (paths.length) {
      const { data: signed } = await supabase.storage.from('selfies').createSignedUrls(paths, 3600)
      setUrls(Object.fromEntries((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])))
    } else setUrls({})
  }, [date, t, company.id])
  useEffect(() => { load() }, [load])

  const doExport = () => exportXlsx(`davomat-${date}`, [{
    name: date,
    rows: rows.map((r) => ({
      [t('col.employee')]: r.full_name,
      [t('col.position')]: r.position || '',
      [t('col.status')]: t('status.' + r.status),
      [t('col.in')]: r.check_in_at ? fmtTime(r.check_in_at, tz) : '',
      [t('col.out')]: r.check_out_at ? fmtTime(r.check_out_at, tz) + (r.check_out_auto ? ` (${t('att.auto_out')})` : '') : '',
      [t('col.late_min')]: r.status === 'late' ? r.late_minutes : 0,
      [t('col.early_min')]: r.early_leave_minutes || 0,
      [t('col.worked_min')]: r.worked_minutes ?? '',
      [t('col.distance')]: r.check_in_distance ?? '',
      [t('col.note')]: r.note || '',
    })),
  }])

  return (
    <>
      <div className="toolbar">
        <DayPicker value={date} max={today} onChange={setDate} />
        <div className="toolbar-spacer" />
        <Button variant="secondary" onClick={doExport} disabled={!rows?.length}>{t('common.export_excel')}</Button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty title={t('att.no_employees')} /> : (
        <>
        <section className="panel only-mobile">
          <h2>{t('att.who_when')}</h2>
          <Arrivals rows={rows} tz={tz} grace={grace} onOpen={(r) => r.status !== 'future' && setEdit(r)} />
        </section>
        <div className="table-wrap only-desktop">
          <table className="table">
            <thead>
              <tr>
                <th>{t('col.employee')}</th><th>{t('col.status')}</th><th>{t('col.in')}</th><th>{t('col.out')}</th>
                <th className="num">{t('col.early_min')}</th><th className="num">{t('col.worked')}</th>
                <th className="num">{t('col.distance')}</th><th>{t('col.selfie')}</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.member_id} className={cls(!r.expected && !r.attendance_id && 'row-dim')}>
                  <td><div className="cell-name">{r.full_name}</div>{r.position && <div className="muted small">{r.position}</div>}</td>
                  <td><StatusBadge status={r.status} minutes={r.late_minutes} />{r.note && <div className="muted small">{r.note}</div>}</td>
                  <td>{fmtTime(r.check_in_at, tz)}</td>
                  <td>{fmtTime(r.check_out_at, tz)}{r.check_out_auto && <span className="auto-tag" title={t('att.auto_out_hint')}>{t('att.auto_out')}</span>}</td>
                  <td className="num">{r.early_leave_minutes ? fmtMinutes(r.early_leave_minutes, t) : '—'}</td>
                  <td className="num">{fmtMinutes(r.worked_minutes, t)}</td>
                  <td className="num">{r.check_in_distance != null ? `${r.check_in_distance} m` : '—'}</td>
                  <td>
                    {urls[r.check_in_selfie] ? (
                      <div className="selfie-cell">
                        <button className="thumb-btn" onClick={() => setPhoto({ ...r, url: urls[r.check_in_selfie], ref: urls[refs[r.member_id]] })}>
                          <img src={urls[r.check_in_selfie]} alt={r.full_name} className="thumb" />
                        </button>
                        <FaceBadge status={r.face_status} distance={r.face_distance} />
                      </div>
                    ) : '—'}
                  </td>
                  <td className="num">
                    {r.status !== 'future' && <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>{t('common.edit')}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {edit && (
        <EditRecord
          row={edit} date={date} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }}
          selfie={urls[edit.check_in_selfie]} reference={urls[refs[edit.member_id]]}
        />
      )}
      <Modal open={Boolean(photo)} onClose={() => setPhoto(null)} title={photo?.full_name || ''} wide={Boolean(photo?.ref)}>
        {photo && (
          photo.ref ? (
            <div className="stack">
              <div className="face-compare">
                <figure><img src={photo.ref} alt="" /><figcaption>{t('face.reference')}</figcaption></figure>
                <figure><img src={photo.url} alt="" /><figcaption>{t('face.checkin_photo')}, {fmtTime(photo.check_in_at, tz)}</figcaption></figure>
              </div>
              <div><FaceBadge status={photo.face_status} distance={photo.face_distance} /></div>
            </div>
          ) : <img src={photo.url} alt={photo.full_name} className="photo-full" />
        )}
      </Modal>
    </>
  )
}

const ARR_ORDER = { present: 0, late: 0, not_yet: 1, absent: 2, excused: 3, holiday: 4, off: 5, future: 6 }

// Telefonda: kim qachon keldi — har bir xodim uchun ish boshlanishi atrofidagi shkala
function Arrivals({ rows, tz, grace = {}, onOpen }) {
  const { t } = useI18n()
  const starts = rows.map((r) => toMin(r.work_start)).filter((v) => v != null)
  const minS = starts.length ? Math.min(...starts) : 540
  const maxS = starts.length ? Math.max(...starts) : 540
  let from = minS - 60
  let to = maxS + 60
  for (const r of rows) {
    if (!r.check_in_at) continue
    const m = toMin(fmtTime(r.check_in_at, tz))
    from = Math.min(from, Math.floor(m / 30) * 30)
    to = Math.max(to, Math.min(maxS + 240, Math.ceil(m / 30) * 30))
  }
  const span = to - from
  const pct = (m) => ((Math.min(to, Math.max(from, m)) - from) / span) * 100
  const sorted = [...rows].sort((a, b) => {
    const d = ARR_ORDER[a.status] - ARR_ORDER[b.status]
    if (d) return d
    if (a.check_in_at && b.check_in_at) return a.check_in_at.localeCompare(b.check_in_at)
    return a.full_name.localeCompare(b.full_name)
  })
  const short = (name) => { const [f, l] = name.split(' '); return l ? `${f} ${l[0]}.` : f }

  return (
    <div className="arrivals">
      <p className="muted small" style={{ margin: '0 0 6px' }}>{t('att.who_when_hint')}</p>
      <div className="arr-axis" aria-hidden="true">
        <span />
        <div className="tl-axis">
          <span style={{ left: '0%' }}>{fromMin(from)}</span>
          <span style={{ left: `${pct(minS)}%` }}>{fromMin(minS)}</span>
          <span style={{ left: '100%' }}>{fromMin(to)}</span>
        </div>
      </div>
      {sorted.map((r) => {
        const ws = toMin(r.work_start)
        const inM = r.check_in_at ? toMin(fmtTime(r.check_in_at, tz)) : null
        const flagged = r.face_status === 'mismatch' || r.face_status === 'no_face'
        return (
          <button key={r.member_id} className="arr-row" onClick={() => onOpen(r)} aria-label={`${r.full_name}: ${t('status.' + r.status)}${inM != null ? ', ' + fromMin(inM) : ''}`}>
            <span className="arr-name">{short(r.full_name)}{flagged && <span className="arr-flag" title={t('face.mismatch')}>!</span>}</span>
            {inM != null ? (
              <span className="arr-bar">
                {grace[r.member_id] > 0 && (
                  <span className="arr-grace-zone" style={{ left: `${pct(ws)}%`, width: `${pct(ws + grace[r.member_id]) - pct(ws)}%` }} />
                )}
                <span className="arr-start" style={{ left: `${pct(ws)}%` }} />
                {r.status === 'late' && <span className="arr-late-seg" style={{ left: `${pct(ws)}%`, width: `${pct(inM) - pct(ws)}%` }} />}
                <span className="arr-dot" style={{ left: `${pct(inM)}%`, background: r.status === 'late' ? 'var(--saffron)' : 'var(--firuza)' }} />
                <span className="arr-time" style={pct(inM) > 55 ? { left: 10, color: r.status === 'late' ? 'var(--saffron-ink)' : 'var(--firuza-700)' } : { right: 10, color: r.status === 'late' ? 'var(--saffron-ink)' : 'var(--firuza-700)' }}>
                  {fromMin(inM)}{r.status === 'late' ? ` (+${r.late_minutes})` : ''}
                </span>
              </span>
            ) : (
              <span className={`arr-state st-${r.status}`}>{t('status.' + r.status)}{r.note ? `: ${r.note}` : ''}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function EditRecord({ row, date, onClose, onSaved, selfie, reference }) {
  const { t } = useI18n()
  const { company, member } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const initial = ['present', 'late', 'excused', 'absent'].includes(row.status) ? row.status : 'excused'
  const [f, setF] = useState({
    status: initial,
    late_minutes: row.late_minutes || 0,
    early_leave_minutes: row.early_leave_minutes || 0,
    note: row.note || '',
  })
  const outInitial = row.check_out_at ? fmtTime(row.check_out_at, company.timezone) : ''
  const [out, setOut] = useState(outInitial)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const payload = {
      status: f.status,
      late_minutes: f.status === 'late' ? Number(f.late_minutes) || 0 : 0,
      early_leave_minutes: Number(f.early_leave_minutes) || 0,
      note: f.note.trim() || null,
      edited_by: member.id,
      edited_at: new Date().toISOString(),
    }
    const { error } = row.attendance_id
      ? await supabase.from('attendance').update(payload).eq('id', row.attendance_id)
      : await supabase.from('attendance').insert({ ...payload, company_id: company.id, member_id: row.member_id, work_date: date })
    if (error) { setBusy(false); return toast(errorText(error, t), 'error') }
    // Ketish vaqti o'zgargan bo'lsa — server ishlangan vaqt va erta ketishni qayta hisoblaydi
    if (row.attendance_id && row.check_in_at && out !== outInitial) {
      const r = await supabase.rpc('admin_set_checkout', { p_attendance: row.attendance_id, p_time: out || null })
      if (r.error) { setBusy(false); return toast(errorText(r.error, t), 'error') }
    }
    setBusy(false)
    toast(t('common.saved'))
    onSaved()
  }

  const remove = async () => {
    if (!await confirm(t('att.delete_confirm'))) return
    const { error } = await supabase.from('attendance').delete().eq('id', row.attendance_id)
    if (error) return toast(errorText(error, t), 'error')
    onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${row.full_name}, ${fmtDate(date)}`}
      footer={
        <>
          {row.attendance_id && <Button variant="danger-ghost" onClick={remove}>{t('att.delete_record')}</Button>}
          <div className="toolbar-spacer" />
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="stack">
        {selfie && (
          reference ? (
            <div className="stack">
              <div className="face-compare">
                <figure><img src={reference} alt="" /><figcaption>{t('face.reference')}</figcaption></figure>
                <figure><img src={selfie} alt="" /><figcaption>{t('face.checkin_photo')}, {fmtTime(row.check_in_at, company.timezone)}</figcaption></figure>
              </div>
              <div><FaceBadge status={row.face_status} distance={row.face_distance} /></div>
            </div>
          ) : <img src={selfie} alt="" className="photo-full" style={{ maxHeight: 260, objectFit: 'cover' }} />
        )}
        {row.check_out_auto && <Alert kind="warn">{t('att.auto_out_hint')}</Alert>}
        {row.check_in_at && (
          <Field label={t('att.checkout_time')} hint={t('att.checkout_time_hint')}>
            <TimeInput allowEmpty value={out} onChange={setOut} style={{ width: 110 }} />
          </Field>
        )}
        <Field label={t('col.status')}>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {['present', 'late', 'excused', 'absent'].map((s) => <option key={s} value={s}>{t('status.' + s)}</option>)}
          </select>
        </Field>
        {f.status === 'excused' && <p className="muted small">{t('att.excused_hint')}</p>}
        <div className="grid-2-tight">
          <Field label={t('col.late_min')}>
            <input type="number" min="0" disabled={f.status !== 'late'} value={f.late_minutes} onChange={(e) => setF({ ...f, late_minutes: e.target.value })} />
          </Field>
          <Field label={t('col.early_min')}>
            <input type="number" min="0" value={f.early_leave_minutes} onChange={(e) => setF({ ...f, early_leave_minutes: e.target.value })} />
          </Field>
        </div>
        <Field label={t('col.note')}>
          <textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t('att.note_ph')} />
        </Field>
      </div>
    </Modal>
  )
}

const CELL = { present: '✓', absent: '✕', excused: 'S', holiday: '★', not_yet: '…', off: '', future: '' }

function Monthly() {
  const { t } = useI18n()
  const { company } = useAuth()
  const [month, setMonth] = useState(todayIn(company.timezone).slice(0, 7))
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    const d = month + '-01'
    Promise.all([
      supabase.rpc('month_matrix', { p_month: d }),
      supabase.rpc('month_report', { p_month: d }),
    ]).then(([mx, rep]) => {
      if (!alive) return
      const err = mx.error || rep.error
      setError(err ? errorText(err, t) : null)
      const byId = Object.fromEntries((rep.data || []).map((r) => [r.member_id, r]))
      setData({ matrix: mx.data || [], byId })
    })
    return () => { alive = false }
  }, [month, t])

  const days = useMemo(() => data?.matrix[0]?.days.map((x) => x.d) || [], [data])

  const doExport = () => {
    const summary = data.matrix.map((m) => {
      const r = data.byId[m.member_id] || {}
      return {
        [t('col.employee')]: m.full_name,
        [t('rep.planned')]: r.planned_days, [t('rep.on_time')]: r.on_time_days, [t('rep.late')]: r.late_days,
        [t('rep.absent')]: r.absent_days, [t('rep.excused')]: r.excused_days,
        [t('col.late_min')]: r.late_minutes, [t('col.early_min')]: r.early_minutes,
        [t('col.worked_h')]: r.worked_minutes != null ? Math.round(r.worked_minutes / 6) / 10 : '',
      }
    })
    const matrix = data.matrix.map((m) => {
      const row = { [t('col.employee')]: m.full_name }
      m.days.forEach((x) => { row[String(x.d)] = x.s === 'late' ? `${x.l}'` : CELL[x.s] ?? '' })
      return row
    })
    exportXlsx(`davomat-${month}`, [{ name: t('att.summary'), rows: summary }, { name: t('att.matrix'), rows: matrix }])
  }

  return (
    <>
      <div className="toolbar">
        <MonthPicker value={month} onChange={setMonth} />
        <div className="toolbar-spacer" />
        <Button variant="secondary" onClick={doExport} disabled={!data?.matrix.length}>{t('common.export_excel')}</Button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? <Spinner /> : data.matrix.length === 0 ? <Empty title={t('att.no_employees')} /> : (
        <>
          <p className="muted small only-mobile" style={{ margin: '0 0 -6px' }}>{t('att.scroll_hint')}</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('att.monthly')}>
            <table className="table matrix">
              <thead>
                <tr>
                  <th className="sticky-col">{t('col.employee')}</th>
                  <th className="num">{t('rep.on_time_s')}</th><th className="num">{t('rep.late_s')}</th>
                  <th className="num">{t('rep.absent_s')}</th><th className="num mx-sep">{t('col.late_min')}</th>
                  {days.map((d) => <th key={d} className="mx-day">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((m) => {
                  const r = data.byId[m.member_id] || {}
                  return (
                    <tr key={m.member_id}>
                      <td className="sticky-col cell-name">{m.full_name}</td>
                      <td className="num">{r.on_time_days ?? '—'}</td>
                      <td className="num">{r.late_days ?? '—'}</td>
                      <td className="num">{r.absent_days ?? '—'}</td>
                      <td className="num mx-sep">{r.late_minutes ?? '—'}</td>
                      {m.days.map((x) => (
                        <td key={x.d} className={cls('mx-cell', `st-${x.s}`)} title={`${x.d}: ${t('status.' + x.s)}${x.s === 'late' ? ` (${x.l} min)` : ''}`}>
                          {x.s === 'late' ? x.l : CELL[x.s]}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="legend">
            <span className="legend-item"><i className="legend-sw st-present">✓</i>{t('status.present')}</span>
            <span className="legend-item"><i className="legend-sw st-late">15</i>{t('att.legend_late')}</span>
            <span className="legend-item"><i className="legend-sw st-absent">✕</i>{t('status.absent')}</span>
            <span className="legend-item"><i className="legend-sw st-excused">S</i>{t('status.excused')}</span>
            <span className="legend-item"><i className="legend-sw st-holiday">★</i>{t('status.holiday')}</span>
          </div>
        </>
      )}
    </>
  )
}
