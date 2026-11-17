import { useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Empty, Field, Modal, PageHeader, Spinner, Tabs, Toggle, useToast } from '../../components/ui.jsx'
import { errorText, fmtDate, fmtMoney, hhmm } from '../../lib/utils.js'
import useMembers from './useMembers.js'
import { WeekdayPicker } from './Settings.jsx'

export function InvitePanel() {
  const { t } = useI18n()
  const { company } = useAuth()
  const toast = useToast()
  const link = `${window.location.origin}${window.location.pathname}#/join?code=${company.join_code}`
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast(t('common.copied')) } catch { window.prompt('', text) }
  }
  return (
    <section className="panel invite">
      <div>
        <h2>{t('emp.invite_title')}</h2>
        <p className="muted">{t('emp.invite_text')}</p>
      </div>
      <div className="invite-code">
        <span className="code-big">{company.join_code}</span>
        <div className="invite-actions">
          <Button size="sm" variant="secondary" onClick={() => copy(company.join_code)}>{t('emp.copy_code')}</Button>
          <Button size="sm" variant="secondary" onClick={() => copy(link)}>{t('emp.copy_link')}</Button>
        </div>
      </div>
    </section>
  )
}

export default function Employees() {
  const { t } = useI18n()
  const { company, member: me, refresh: refreshMe } = useAuth()
  const toast = useToast()
  const { members, error, reload } = useMembers()
  const [tab, setTab] = useState('active')
  const [edit, setEdit] = useState(null)

  if (!members) return <Spinner />
  const groups = {
    active: members.filter((m) => m.status === 'active'),
    pending: members.filter((m) => m.status === 'pending'),
    inactive: members.filter((m) => m.status === 'inactive'),
  }
  const list = groups[tab]

  const approve = async (m) => {
    const { error } = await supabase.from('members').update({ status: 'active' }).eq('id', m.id)
    if (error) return toast(errorText(error, t), 'error')
    toast(t('emp.approved', { name: m.full_name }))
    await reload()
    setEdit({ ...m, status: 'active' })
  }
  const reject = async (m) => {
    if (!window.confirm(t('emp.reject_confirm', { name: m.full_name }))) return
    const { error } = await supabase.from('members').delete().eq('id', m.id)
    if (error) return toast(errorText(error, t), 'error')
    reload()
  }

  return (
    <div className="stack-lg">
      <PageHeader title={t('nav.employees')} />
      <InvitePanel />
      {error && <Alert kind="error">{errorText(error, t)}</Alert>}
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'active', label: t('emp.tab_active'), count: groups.active.length },
        { value: 'pending', label: t('emp.tab_pending'), count: groups.pending.length },
        { value: 'inactive', label: t('emp.tab_inactive'), count: groups.inactive.length },
      ]} />
      {list.length === 0 ? (
        <Empty title={tab === 'pending' ? t('emp.empty_pending') : t('emp.empty')} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('col.employee')}</th><th>{t('col.contact')}</th><th>{t('col.role')}</th>
                <th>{t('col.schedule')}</th><th className="num">{t('col.salary')}</th><th />
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="cell-name">{m.full_name}{m.id === me.id ? ` (${t('emp.you')})` : ''}</div>
                    <div className="muted small">{m.position || '—'}</div>
                  </td>
                  <td><div>{m.phone || '—'}</div><div className="muted small">{m.email}</div></td>
                  <td>
                    {t('role.' + m.role)}
                    {!m.track_attendance && <div className="muted small">{t('emp.not_tracked')}</div>}
                  </td>
                  <td>
                    {m.custom_schedule
                      ? `${hhmm(m.work_start || company.work_start)}–${hhmm(m.work_end || company.work_end)}`
                      : <span className="muted">{t('emp.common_schedule')}</span>}
                  </td>
                  <td className="num">{fmtMoney(m.base_salary, company.currency)}</td>
                  <td className="num nowrap">
                    {m.status === 'pending' ? (
                      <>
                        <Button size="sm" onClick={() => approve(m)}>{t('emp.approve')}</Button>{' '}
                        <Button size="sm" variant="danger-ghost" onClick={() => reject(m)}>{t('emp.reject')}</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setEdit(m)}>{t('common.edit')}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <EditMember
          m={edit}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); reload(); if (edit.id === me.id) refreshMe() }}
        />
      )}
    </div>
  )
}

function EditMember({ m, onClose, onSaved }) {
  const { t } = useI18n()
  const { company, member: me } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({
    full_name: m.full_name, phone: m.phone || '', position: m.position || '',
    role: m.role, status: m.status, base_salary: m.base_salary ?? 0, start_date: m.start_date,
    track_attendance: m.track_attendance,
    custom_schedule: m.custom_schedule,
    work_start: hhmm(m.work_start || company.work_start), work_end: hhmm(m.work_end || company.work_end),
    grace_minutes: m.grace_minutes ?? company.grace_minutes,
    break_start: hhmm(m.break_start || company.break_start || ''), break_end: hhmm(m.break_end || company.break_end || ''),
    work_days: m.work_days || company.work_days,
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    setBusy(true)
    const payload = {
      full_name: f.full_name.trim(), phone: f.phone.trim() || null, position: f.position.trim() || null,
      role: f.role, status: f.status, base_salary: Number(f.base_salary) || 0, start_date: f.start_date,
      track_attendance: f.track_attendance, custom_schedule: f.custom_schedule,
      ...(f.custom_schedule
        ? {
            work_start: f.work_start, work_end: f.work_end, grace_minutes: Number(f.grace_minutes) || 0,
            break_start: f.break_start && f.break_start !== '—' ? f.break_start : null,
            break_end: f.break_end && f.break_end !== '—' ? f.break_end : null,
            work_days: f.work_days,
          }
        : { work_start: null, work_end: null, grace_minutes: null, break_start: null, break_end: null, work_days: null }),
    }
    const { error } = await supabase.from('members').update(payload).eq('id', m.id)
    setBusy(false)
    if (error) return toast(errorText(error, t), 'error')
    toast(t('common.saved'))
    onSaved()
  }

  const remove = async () => {
    if (!window.confirm(t('emp.delete_confirm', { name: m.full_name }))) return
    const { error } = await supabase.from('members').delete().eq('id', m.id)
    if (error) return toast(errorText(error, t), 'error')
    onSaved()
  }

  return (
    <Modal
      open wide onClose={onClose} title={m.full_name}
      footer={
        <>
          {m.id !== me.id && <Button variant="danger-ghost" onClick={remove}>{t('emp.delete')}</Button>}
          <div className="toolbar-spacer" />
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={busy}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={t('auth.full_name')}><input value={f.full_name} onChange={set('full_name')} /></Field>
        <Field label={t('col.position')}><input value={f.position} onChange={set('position')} placeholder={t('emp.position_ph')} /></Field>
        <Field label={t('auth.phone')}><input type="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label={t('emp.start_date')} hint={t('emp.start_date_hint')}><input type="date" value={f.start_date} onChange={set('start_date')} /></Field>
        <Field label={t('col.role')}>
          <select value={f.role} onChange={set('role')}>
            <option value="employee">{t('role.employee')}</option>
            <option value="admin">{t('role.admin')}</option>
          </select>
        </Field>
        <Field label={t('col.status')}>
          <select value={f.status} onChange={set('status')}>
            <option value="active">{t('emp.status_active')}</option>
            <option value="inactive">{t('emp.status_inactive')}</option>
          </select>
        </Field>
        <Field label={`${t('col.salary')} (${company.currency})`} hint={t('emp.salary_hint')}>
          <input type="number" min="0" step="1000" value={f.base_salary} onChange={set('base_salary')} />
        </Field>
      </div>
      <div className="stack" style={{ marginTop: 16 }}>
        <Toggle checked={f.track_attendance} onChange={(v) => setF({ ...f, track_attendance: v })} label={t('emp.track')} hint={t('emp.track_hint')} />
        <Toggle checked={f.custom_schedule} onChange={(v) => setF({ ...f, custom_schedule: v })} label={t('emp.custom_schedule')} hint={t('emp.custom_schedule_hint')} />
        {f.custom_schedule && (
          <div className="subpanel">
            <div className="form-grid">
              <Field label={t('set.work_start')}><input type="time" value={f.work_start} onChange={set('work_start')} /></Field>
              <Field label={t('set.work_end')}><input type="time" value={f.work_end} onChange={set('work_end')} /></Field>
              <Field label={t('set.grace')}><input type="number" min="0" max="240" value={f.grace_minutes} onChange={set('grace_minutes')} /></Field>
              <Field label={t('set.break_start')}><input type="time" value={f.break_start === '—' ? '' : f.break_start} onChange={set('break_start')} /></Field>
              <Field label={t('set.break_end')}><input type="time" value={f.break_end === '—' ? '' : f.break_end} onChange={set('break_end')} /></Field>
            </div>
            <Field label={t('set.work_days')}>
              <WeekdayPicker value={f.work_days} onChange={(v) => setF({ ...f, work_days: v })} />
            </Field>
          </div>
        )}
        <p className="muted small">{t('emp.joined', { date: fmtDate(m.created_at) })}</p>
      </div>
    </Modal>
  )
}
