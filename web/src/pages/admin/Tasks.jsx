import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Empty, Field, Modal, PageHeader, Spinner, useToast, useConfirm } from '../../components/ui.jsx'
import { cls, errorText, fmtDate, monthEnd, todayIn } from '../../lib/utils.js'
import { TaskStatus } from '../employee/MyTasks.jsx'
import useMembers from './useMembers.js'

export default function Tasks() {
  const { t } = useI18n()
  const { company } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const today = todayIn(company.timezone)
  const { members } = useMembers()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [who, setWho] = useState('')
  const [status, setStatus] = useState('')
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState(null)
  const [edit, setEdit] = useState(null)

  const load = useCallback(async () => {
    let q = supabase.from('tasks').select('*').eq('company_id', company.id)
      .gte('due_date', month + '-01').lte('due_date', monthEnd(month + '-01'))
      .order('due_date').order('created_at')
    if (who) q = q.eq('assignee_id', who)
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    setError(error ? errorText(error, t) : null)
    setTasks(data || [])
  }, [company.id, month, who, status, t])
  useEffect(() => { load() }, [load])

  const active = useMemo(() => (members || []).filter((m) => m.status === 'active'), [members])
  const nameOf = useMemo(() => Object.fromEntries((members || []).map((m) => [m.id, m.full_name])), [members])

  const remove = async (task) => {
    if (!await confirm(t('task.delete_confirm'))) return
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) return toast(errorText(error, t), 'error')
    load()
  }

  return (
    <div className="stack-lg">
      <PageHeader title={t('nav.tasks')} sub={t('task.page_sub')}>
        <Button onClick={() => setEdit({})} disabled={!active.length}>{t('task.new')}</Button>
      </PageHeader>
      <div className="toolbar">
        <Field className="field-inline" label={t('common.month')}>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </Field>
        <Field className="field-inline" label={t('col.employee')}>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {active.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </Field>
        <Field className="field-inline" label={t('col.status')}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {['todo', 'in_progress', 'done'].map((s) => <option key={s} value={s}>{t('task.' + s)}</option>)}
          </select>
        </Field>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!tasks ? <Spinner /> : tasks.length === 0 ? (
        <Empty title={t('task.empty_admin')} action={active.length ? <Button onClick={() => setEdit({})}>{t('task.new')}</Button> : null} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('task.title')}</th><th>{t('col.employee')}</th><th>{t('task.due')}</th>
                <th className="num">{t('task.points')}</th><th>{t('col.status')}</th><th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((x) => {
                const overdue = x.status !== 'done' && x.due_date < today
                return (
                  <tr key={x.id}>
                    <td><div className="cell-name">{x.title}</div>{x.description && <div className="muted small clamp">{x.description}</div>}</td>
                    <td>{nameOf[x.assignee_id] || '—'}</td>
                    <td className={cls(overdue && 'text-danger')}>{fmtDate(x.due_date)}{overdue ? ` (${t('task.overdue_s')})` : ''}</td>
                    <td className="num">{x.points}</td>
                    <td><TaskStatus status={x.status} /></td>
                    <td className="num nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setEdit(x)}>{t('common.edit')}</Button>
                      <Button size="sm" variant="danger-ghost" onClick={() => remove(x)}>{t('common.delete')}</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <TaskForm task={edit} members={active} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

function TaskForm({ task, members, onClose, onSaved }) {
  const { t } = useI18n()
  const { company, member } = useAuth()
  const toast = useToast()
  const isNew = !task.id
  const [f, setF] = useState({
    assignee_id: task.assignee_id || members[0]?.id || '',
    title: task.title || '', description: task.description || '',
    due_date: task.due_date || todayIn(company.timezone), points: task.points || 1, status: task.status || 'todo',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async (e) => {
    e?.preventDefault()
    setBusy(true)
    const payload = {
      assignee_id: f.assignee_id, title: f.title.trim(), description: f.description.trim() || null,
      due_date: f.due_date, points: Number(f.points) || 1, status: f.status,
    }
    const { error } = isNew
      ? await supabase.from('tasks').insert({ ...payload, company_id: company.id, created_by: member.id })
      : await supabase.from('tasks').update(payload).eq('id', task.id)
    setBusy(false)
    if (error) return toast(errorText(error, t), 'error')
    toast(t('common.saved'))
    onSaved()
  }

  return (
    <Modal
      open onClose={onClose} title={isNew ? t('task.new') : t('task.edit')}
      footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={save} loading={busy} disabled={!f.title.trim() || !f.assignee_id}>{t('common.save')}</Button></>}
    >
      <form className="stack" onSubmit={save}>
        <Field label={t('task.title')}><input required value={f.title} onChange={set('title')} /></Field>
        <Field label={t('task.description')}><textarea rows={3} value={f.description} onChange={set('description')} /></Field>
        <Field label={t('col.employee')}>
          <select value={f.assignee_id} onChange={set('assignee_id')}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </Field>
        <div className="grid-2-tight">
          <Field label={t('task.due')}><input type="date" required value={f.due_date} onChange={set('due_date')} /></Field>
          <Field label={t('task.points')} hint={t('task.points_hint')}><input type="number" min="1" max="10" value={f.points} onChange={set('points')} /></Field>
        </div>
        {!isNew && (
          <Field label={t('col.status')}>
            <select value={f.status} onChange={set('status')}>
              {['todo', 'in_progress', 'done'].map((s) => <option key={s} value={s}>{t('task.' + s)}</option>)}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  )
}
