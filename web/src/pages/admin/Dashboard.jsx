import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Empty, PageHeader, Spinner, StatusBadge } from '../../components/ui.jsx'
import { addDays, errorText, fmtDate, fmtNum, fmtTime, todayIn } from '../../lib/utils.js'

export const CHART = {
  present: '#138A5E', late: '#E9A100', absent: '#C93C3C', excused: '#6F63CC',
  grid: '#E4E6EF', axis: '#5D6280', kpi: '#23255C',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="chart-tip-title">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="chart-tip-row">
          <i style={{ background: p.color || p.fill }} />
          <span>{p.name}</span>
          <b>{typeof p.value === 'number' ? fmtNum(p.value, p.dataKey === 'kpi' ? 1 : 0) : p.value}</b>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { t } = useI18n()
  const { company } = useAuth()
  const tz = company.timezone
  const today = todayIn(tz)
  const [d, setD] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.rpc('attendance_grid', { p_from: today, p_to: today }),
      supabase.rpc('daily_stats', { p_from: addDays(today, -29), p_to: today }),
      supabase.rpc('month_report', { p_month: today }),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'pending'),
      supabase.from('company_telegram').select('enabled').eq('company_id', company.id).maybeSingle(),
    ]).then(([grid, stats, rep, pending, tg]) => {
      if (!alive) return
      const err = grid.error || stats.error || rep.error
      if (err) setError(errorText(err, t))
      setD({
        today: grid.data || [],
        stats: (stats.data || []).filter((r) => r.expected > 0),
        report: rep.data || [],
        pending: pending.count || 0,
        tgEnabled: tg.data?.enabled,
      })
    })
    return () => { alive = false }
  }, [company.id, today, t])

  if (!d) return <Spinner />

  const exp = d.today.filter((r) => r.expected || ['present', 'late'].includes(r.status))
  const count = (s) => exp.filter((r) => r.status === s).length
  const tiles = [
    { key: 'expected', label: t('dash.expected'), value: exp.length },
    { key: 'present', label: t('status.present'), value: count('present') },
    { key: 'late', label: t('status.late'), value: count('late') },
    { key: 'absent', label: t('dash.not_here'), value: count('absent') + count('not_yet') },
    { key: 'excused', label: t('status.excused'), value: count('excused') },
  ]
  const faceFlags = d.today.filter((r) => r.face_status === 'mismatch' || r.face_status === 'no_face').length
  const issues = exp.filter((r) => ['late', 'absent', 'not_yet'].includes(r.status))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'late' ? 1 : -1))

  const trend = d.stats.map((r) => ({ label: fmtDate(r.day).slice(0, 5), on_time: r.on_time, late: r.late, absent: r.absent }))
  const kpiRows = d.report.filter((r) => r.kpi != null).map((r) => ({ name: r.full_name, kpi: Number(r.kpi) }))
    .sort((a, b) => b.kpi - a.kpi)

  return (
    <div className="stack-lg">
      <PageHeader title={t('nav.dashboard')} sub={fmtDate(today)} />
      {error && <Alert kind="error">{error}</Alert>}

      {company.office_lat == null && (
        <Alert kind="warn" action={<Link className="btn btn-sm btn-primary" to="/settings">{t('nav.settings')}</Link>}>{t('dash.no_office')}</Alert>
      )}
      {faceFlags > 0 && (
        <Alert kind="warn" action={<Link className="btn btn-sm btn-primary" to="/attendance">{t('dash.check')}</Link>}>{t('dash.face_flags', { n: faceFlags })}</Alert>
      )}
      {d.pending > 0 && (
        <Alert kind="info" action={<Link className="btn btn-sm btn-primary" to="/employees">{t('dash.review')}</Link>}>{t('dash.pending', { n: d.pending })}</Alert>
      )}
      {d.tgEnabled === false && (
        <Alert kind="info" action={<Link className="btn btn-sm btn-ghost" to="/settings">{t('dash.setup')}</Link>}>{t('dash.no_telegram')}</Alert>
      )}

      <div className="tiles">
        {tiles.map((x) => (
          <div key={x.key} className={`tile tile-${x.key}`}>
            <span className="tile-num">{x.value}</span>
            <span className="tile-label">{x.label}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>{t('dash.trend')}</h2>
          {trend.length === 0 ? <Empty title={t('dash.no_data')} /> : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="18%">
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(35,37,92,.06)' }} />
                  <Bar dataKey="on_time" name={t('status.present')} stackId="a" fill={CHART.present} stroke="#fff" strokeWidth={2} />
                  <Bar dataKey="late" name={t('status.late')} stackId="a" fill={CHART.late} stroke="#fff" strokeWidth={2} />
                  <Bar dataKey="absent" name={t('status.absent')} stackId="a" fill={CHART.absent} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="legend chart-legend">
                {[['present', t('status.present')], ['late', t('status.late')], ['absent', t('status.absent')]].map(([k, label]) => (
                  <span key={k} className="legend-item"><i className="legend-dot" style={{ background: CHART[k] }} />{label}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>{t('dash.today_issues')}</h2>
          {issues.length === 0 ? <Empty title={t('dash.all_good')} /> : (
            <ul className="people-list">
              {issues.map((r) => (
                <li key={r.member_id}>
                  <span>{r.full_name}</span>
                  <span className="muted small">{r.check_in_at ? fmtTime(r.check_in_at, tz) : ''}</span>
                  <StatusBadge status={r.status} minutes={r.late_minutes} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>{t('dash.kpi_month')}</h2>
        {kpiRows.length === 0 ? <Empty title={t('dash.no_data')} /> : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={Math.max(160, kpiRows.length * 34 + 30)}>
              <BarChart data={kpiRows} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={CHART.grid} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: '#1B1F3B' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(35,37,92,.06)' }} />
                <Bar dataKey="kpi" name="KPI" fill={CHART.kpi} radius={[0, 4, 4, 0]} barSize={18}
                  label={{ position: 'right', fontSize: 12, fill: '#1B1F3B', formatter: (v) => fmtNum(v, 1) }}>
                  {kpiRows.map((r) => <Cell key={r.name} fill={CHART.kpi} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}
