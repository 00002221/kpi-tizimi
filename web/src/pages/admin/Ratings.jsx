import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Empty, Field, PageHeader, Spinner, useToast } from '../../components/ui.jsx'
import { errorText, todayIn } from '../../lib/utils.js'
import useMembers from './useMembers.js'

export default function Ratings() {
  const { t } = useI18n()
  const { company, member } = useAuth()
  const toast = useToast()
  const { members } = useMembers()
  const [month, setMonth] = useState(todayIn(company.timezone).slice(0, 7))
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const period = month + '-01'

  useEffect(() => {
    let alive = true
    setSaved(null)
    supabase.from('ratings').select('*').eq('company_id', company.id).eq('period', period).then(({ data, error }) => {
      if (!alive) return
      setError(error ? errorText(error, t) : null)
      const map = Object.fromEntries((data || []).map((r) => [r.member_id, { score: r.score, comment: r.comment || '' }]))
      setSaved(map)
      setDraft(map)
    })
    return () => { alive = false }
  }, [company.id, period, t])

  const people = useMemo(() => (members || []).filter((m) => m.status === 'active' && m.track_attendance), [members])
  const changed = people.filter((p) => {
    const a = draft[p.id], b = saved?.[p.id]
    return a?.score && (a.score !== b?.score || (a.comment || '') !== (b?.comment || ''))
  })

  const setScore = (id, score) => setDraft({ ...draft, [id]: { ...draft[id], score } })
  const setComment = (id, comment) => setDraft({ ...draft, [id]: { ...draft[id], comment } })

  const save = async () => {
    setBusy(true)
    const rows = changed.map((p) => ({
      company_id: company.id, member_id: p.id, period,
      score: draft[p.id].score, comment: draft[p.id].comment?.trim() || null, rated_by: member.id,
    }))
    const { error } = await supabase.from('ratings').upsert(rows, { onConflict: 'member_id,period' })
    setBusy(false)
    if (error) return toast(errorText(error, t), 'error')
    setSaved({ ...saved, ...Object.fromEntries(rows.map((r) => [r.member_id, { score: r.score, comment: r.comment || '' }])) })
    toast(t('common.saved'))
  }

  return (
    <div className="stack-lg">
      <PageHeader title={t('nav.ratings')} sub={t('rate.sub')}>
        <Button onClick={save} loading={busy} disabled={!changed.length}>
          {changed.length ? t('rate.save_n', { n: changed.length }) : t('common.save')}
        </Button>
      </PageHeader>
      <div className="toolbar">
        <Field className="field-inline" label={t('common.month')}>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </Field>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!saved || !members ? <Spinner /> : people.length === 0 ? <Empty title={t('att.no_employees')} /> : (
        <ul className="rating-list">
          {people.map((p) => (
            <li key={p.id} className="panel rating-item">
              <div className="rating-who">
                <div className="cell-name">{p.full_name}</div>
                <div className="muted small">{p.position || ''}</div>
              </div>
              <div className="score-row" role="radiogroup" aria-label={p.full_name}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={draft[p.id]?.score === n}
                    className={draft[p.id]?.score === n ? 'score score-on' : 'score'}
                    onClick={() => setScore(p.id, n)}
                  >{n}</button>
                ))}
              </div>
              <input
                className="rating-comment"
                placeholder={t('rate.comment_ph')}
                value={draft[p.id]?.comment || ''}
                onChange={(e) => setComment(p.id, e.target.value)}
                disabled={!draft[p.id]?.score}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
