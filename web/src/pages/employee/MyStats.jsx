import { useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Empty, Field, Spinner } from '../../components/ui.jsx'
import KpiBreakdown from '../../components/KpiBreakdown.jsx'
import MonthCalendar from '../../components/MonthCalendar.jsx'
import { errorText, monthEnd, monthStart, todayIn } from '../../lib/utils.js'

export default function MyStats() {
  const { t } = useI18n()
  const { member, company } = useAuth()
  const [month, setMonth] = useState(todayIn(company?.timezone).slice(0, 7))
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    const d = month + '-01'
    Promise.all([
      supabase.rpc('month_report', { p_month: d }),
      supabase.rpc('attendance_grid', { p_from: monthStart(d), p_to: monthEnd(d) }),
    ]).then(([rep, grid]) => {
      if (!alive) return
      const err = rep.error || grid.error
      if (err) { setError(errorText(err, t)); setData({ row: null, days: [] }); return }
      setError(null)
      setData({
        row: (rep.data || []).find((r) => r.member_id === member.id) || null,
        days: (grid.data || []).filter((r) => r.member_id === member.id),
      })
    })
    return () => { alive = false }
  }, [month, member.id, t])

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="page-title">{t('nav.my_stats')}</h1>
        <Field className="field-inline">
          <input type="month" value={month} max={todayIn(company?.timezone).slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </Field>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? <Spinner /> : !data.row ? (
        <Empty title={t('stats.empty')} />
      ) : (
        <>
          <section className="panel"><KpiBreakdown row={data.row} company={company} /></section>
          <section className="panel">
            <h2>{t('stats.calendar')}</h2>
            <MonthCalendar rows={data.days} />
          </section>
        </>
      )}
    </div>
  )
}
