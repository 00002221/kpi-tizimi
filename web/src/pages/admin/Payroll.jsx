import { useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Empty, Modal, PageHeader, Spinner } from '../../components/ui.jsx'
import KpiBreakdown from '../../components/KpiBreakdown.jsx'
import { exportXlsx } from '../../lib/excel.js'
import { errorText, fmtMoney, fmtNum, todayIn } from '../../lib/utils.js'
import { MonthPicker } from '../../components/DatePickers.jsx'

function kpiClass(k) {
  if (k == null) return ''
  return k >= 85 ? 'kpi-good' : k >= 60 ? 'kpi-mid' : 'kpi-low'
}

export default function Payroll() {
  const { t } = useI18n()
  const { company } = useAuth()
  const cur = company.currency
  const thisMonth = todayIn(company.timezone).slice(0, 7)
  const [month, setMonth] = useState(thisMonth)
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    supabase.rpc('month_report', { p_month: month + '-01' }).then(({ data, error }) => {
      if (!alive) return
      setError(error ? errorText(error, t) : null)
      setRows(data || [])
    })
    return () => { alive = false }
  }, [month, t])

  const total = (k) => (rows || []).reduce((s, r) => s + Number(r[k] || 0), 0)

  const doExport = () => exportXlsx(`kpi-oylik-${month}`, [{
    name: month,
    rows: rows.map((r) => ({
      [t('col.employee')]: r.full_name,
      [t('col.position')]: r.position || '',
      [t('rep.planned')]: r.planned_days,
      [t('rep.on_time')]: r.on_time_days,
      [t('rep.late')]: r.late_days,
      [t('rep.absent')]: r.absent_days,
      [t('rep.excused')]: r.excused_days,
      [t('col.late_min')]: r.late_minutes,
      [t('col.early_min')]: r.early_minutes,
      [t('rep.tasks')]: `${r.tasks_done_on_time + r.tasks_done_late}/${r.tasks_total}`,
      [t('rep.rating')]: r.rating ?? '',
      [t('kpi.attendance') + ' %']: r.attendance_score ?? '',
      [t('kpi.tasks') + ' %']: r.task_score ?? '',
      [t('kpi.rating') + ' %']: r.rating_score ?? '',
      KPI: r.kpi ?? '',
      [t('pay.base')]: Number(r.base_salary),
      [t('pay.fixed_part')]: Number(r.fixed_part),
      [t('pay.kpi_part')]: Number(r.kpi_part),
      [t('pay.absence')]: Number(r.absence_deduction),
      [t('pay.late_fine')]: Number(r.late_fine),
      [t('pay.early_fine')]: Number(r.early_fine),
      [t('pay.total')]: Number(r.salary),
    })),
  }])

  return (
    <div className="stack-lg">
      <PageHeader title={t('nav.payroll')} sub={month === thisMonth ? t('pay.current_note') : undefined}>
        <Button variant="secondary" onClick={doExport} disabled={!rows?.length}>{t('common.export_excel')}</Button>
      </PageHeader>
      <div className="toolbar">
        <MonthPicker value={month} max={thisMonth} onChange={setMonth} />
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty title={t('att.no_employees')} /> : (<>
        <div className="m-list only-mobile">
          {rows.map((r) => {
            const ded = Number(r.absence_deduction) + Number(r.late_fine) + Number(r.early_fine)
            return (
              <button key={r.member_id} type="button" className="m-card m-card-col" onClick={() => setDetail(r)}>
                <div className="m-card-row">
                  <div className="m-card-main">
                    <div className="m-card-title">{r.full_name}</div>
                    {r.position && <div className="m-card-sub">{r.position}</div>}
                  </div>
                  <span className={`kpi-pill ${kpiClass(r.kpi)}`}>{r.kpi == null ? '—' : fmtNum(r.kpi, 1)}</span>
                </div>
                <div className="m-card-money">
                  <span className="muted small">{t('pay.total')}</span>
                  <b>{fmtMoney(r.salary, cur)}</b>
                </div>
                <div className="m-card-facts">
                  <span>{t('kpi.attendance')} <b>{r.attendance_score == null ? '—' : fmtNum(r.attendance_score, 1)}</b></span>
                  <span>{t('kpi.tasks')} <b>{r.task_score == null ? '—' : fmtNum(r.task_score, 1)}</b></span>
                  <span>{t('kpi.rating')} <b>{r.rating ?? '—'}</b></span>
                  {ded > 0 && <span className="text-danger">−{fmtMoney(ded, cur)}</span>}
                </div>
              </button>
            )
          })}
          <div className="m-card m-card-total">
            <span>{t('pay.sum')}</span>
            <b>{fmtMoney(total('salary'), cur)}</b>
          </div>
        </div>
        <div className="table-wrap only-desktop">
          <table className="table">
            <thead>
              <tr>
                <th>{t('col.employee')}</th>
                <th className="num">KPI</th>
                <th className="num">{t('kpi.attendance')}</th>
                <th className="num">{t('kpi.tasks')}</th>
                <th className="num">{t('kpi.rating')}</th>
                <th className="num">{t('pay.base')}</th>
                <th className="num">{t('pay.deductions')}</th>
                <th className="num">{t('pay.total')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ded = Number(r.absence_deduction) + Number(r.late_fine) + Number(r.early_fine)
                return (
                  <tr key={r.member_id}>
                    <td><div className="cell-name">{r.full_name}</div><div className="muted small">{r.position || ''}</div></td>
                    <td className="num"><span className={`kpi-pill ${kpiClass(r.kpi)}`}>{r.kpi == null ? '—' : fmtNum(r.kpi, 1)}</span></td>
                    <td className="num">{r.attendance_score == null ? '—' : fmtNum(r.attendance_score, 1)}</td>
                    <td className="num">{r.task_score == null ? '—' : fmtNum(r.task_score, 1)}</td>
                    <td className="num">{r.rating ?? '—'}</td>
                    <td className="num">{fmtMoney(r.base_salary, cur)}</td>
                    <td className="num text-danger">{ded ? `−${fmtMoney(ded, cur)}` : '—'}</td>
                    <td className="num"><b>{fmtMoney(r.salary, cur)}</b></td>
                    <td className="num"><Button size="sm" variant="ghost" onClick={() => setDetail(r)}>{t('pay.details')}</Button></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>{t('pay.sum')}</td>
                <td className="num">{fmtMoney(total('base_salary'), cur)}</td>
                <td className="num">−{fmtMoney(total('absence_deduction') + total('late_fine') + total('early_fine'), cur)}</td>
                <td className="num"><b>{fmtMoney(total('salary'), cur)}</b></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </>)}

      <section className="panel formula">
        <h2>{t('pay.how_title')}</h2>
        <ol>
          <li>{t('pay.how_1', { a: company.w_attendance, b: company.w_tasks, c: company.w_rating })}</li>
          <li>{t('pay.how_2', { credit: fmtNum(Number(company.late_day_credit) * 100) })}</li>
          <li>{t('pay.how_3')}</li>
          <li>{t('pay.how_4', { share: company.kpi_salary_share, fixed: 100 - company.kpi_salary_share })}</li>
          <li>{t('pay.how_5')}</li>
        </ol>
      </section>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.full_name || ''} wide>
        {detail && <KpiBreakdown row={detail} company={company} />}
      </Modal>
    </div>
  )
}
