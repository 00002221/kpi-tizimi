import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Empty, Spinner, Tabs, useToast } from '../../components/ui.jsx'
import { cls, errorText, fmtDate, todayIn } from '../../lib/utils.js'

export function TaskStatus({ status }) {
  const { t } = useI18n()
  return <span className={cls('badge', `task-${status}`)}>{t('task.' + status)}</span>
}

export default function MyTasks() {
  const { t } = useI18n()
  const { member, company } = useAuth()
  const toast = useToast()
  const [tasks, setTasks] = useState(null)
  const [tab, setTab] = useState('active')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const today = todayIn(company?.timezone)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('tasks').select('*').eq('assignee_id', member.id).order('due_date')
    if (error) setError(errorText(error, t))
    setTasks(data || [])
  }, [member.id, t])
  useEffect(() => { load() }, [load])

  const setStatus = async (task, status) => {
    setBusy(task.id)
    const { error } = await supabase.rpc('set_task_status', { p_task: task.id, p_status: status })
    setBusy(null)
    if (error) return toast(errorText(error, t), 'error')
    if (status === 'done') toast(t('task.marked_done'))
    load()
  }

  if (!tasks) return <Spinner />
  const active = tasks.filter((x) => x.status !== 'done')
  const done = tasks.filter((x) => x.status === 'done').reverse()
  const list = tab === 'active' ? active : done

  return (
    <div className="stack">
      <h1 className="page-title">{t('nav.my_tasks')}</h1>
      {error && <Alert kind="error">{error}</Alert>}
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'active', label: t('task.tab_active'), count: active.length },
        { value: 'done', label: t('task.tab_done') },
      ]} />
      {list.length === 0 && <Empty title={tab === 'active' ? t('task.empty_active') : t('task.empty_done')} />}
      <ul className="task-list">
        {list.map((x) => {
          const overdue = x.status !== 'done' && x.due_date < today
          return (
            <li key={x.id} className={cls('task-item', overdue && 'task-overdue')}>
              <div className="task-main">
                <div className="task-title">{x.title}</div>
                {x.description && <p className="task-desc">{x.description}</p>}
                <div className="task-meta">
                  <span className={overdue ? 'text-danger' : 'muted'}>
                    {overdue ? t('task.overdue') : t('task.due')}: {fmtDate(x.due_date)}
                  </span>
                  <span className="muted">{t('task.points_n', { n: x.points })}</span>
                  <TaskStatus status={x.status} />
                </div>
              </div>
              <div className="task-actions">
                {x.status === 'todo' && (
                  <Button size="sm" variant="ghost" loading={busy === x.id} onClick={() => setStatus(x, 'in_progress')}>{t('task.start')}</Button>
                )}
                {x.status !== 'done' && (
                  <Button size="sm" loading={busy === x.id} onClick={() => setStatus(x, 'done')}>{t('task.mark_done')}</Button>
                )}
                {x.status === 'done' && (
                  <Button size="sm" variant="ghost" loading={busy === x.id} onClick={() => setStatus(x, 'in_progress')}>{t('task.reopen')}</Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
