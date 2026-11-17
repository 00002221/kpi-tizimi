import { useI18n } from '../i18n/index.jsx'
import { fmtMinutes, fmtMoney, fmtNum } from '../lib/utils.js'

function Meter({ label, value, weight }) {
  const { t } = useI18n()
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span className="muted small">{t('kpi.weight', { n: weight })}</span>
        <b>{value == null ? '—' : `${fmtNum(value, 1)}%`}</b>
      </div>
      <div className="meter-track"><div className="meter-fill" style={{ width: `${Math.min(100, value ?? 0)}%` }} /></div>
    </div>
  )
}

// Bitta ishchining oylik KPI va maosh tafsiloti (month_report qatoridan)
export default function KpiBreakdown({ row, company, showSalary = true }) {
  const { t } = useI18n()
  const cur = company?.currency || 'UZS'
  return (
    <div className="kpi-breakdown">
      <div className="kpi-hero">
        <span className="kpi-hero-num">{row.kpi == null ? '—' : fmtNum(row.kpi, 1)}</span>
        <span className="kpi-hero-label">{t('kpi.total')}</span>
      </div>
      <div className="meters">
        <Meter label={t('kpi.attendance')} value={row.attendance_score} weight={company.w_attendance} />
        <Meter label={t('kpi.tasks')} value={row.task_score} weight={company.w_tasks} />
        <Meter label={t('kpi.rating')} value={row.rating_score} weight={company.w_rating} />
      </div>

      <dl className="facts">
        <div><dt>{t('rep.on_time')}</dt><dd>{row.on_time_days}</dd></div>
        <div><dt>{t('rep.late')}</dt><dd>{row.late_days}</dd></div>
        <div><dt>{t('rep.absent')}</dt><dd>{row.absent_days}</dd></div>
        <div><dt>{t('rep.excused')}</dt><dd>{row.excused_days}</dd></div>
        <div><dt>{t('rep.late_min')}</dt><dd>{fmtMinutes(row.late_minutes, t)}</dd></div>
        <div><dt>{t('rep.early_min')}</dt><dd>{fmtMinutes(row.early_minutes, t)}</dd></div>
        <div><dt>{t('rep.tasks')}</dt><dd>{row.tasks_done_on_time + row.tasks_done_late} / {row.tasks_total}</dd></div>
        <div><dt>{t('rep.rating')}</dt><dd>{row.rating ?? '—'}{row.rating ? ' / 10' : ''}</dd></div>
      </dl>

      {showSalary && (
        <table className="salary-table">
          <tbody>
            <tr><td>{t('pay.base')}</td><td>{fmtMoney(row.base_salary, cur)}</td></tr>
            <tr><td>{t('pay.fixed_part')}</td><td>{fmtMoney(row.fixed_part, cur)}</td></tr>
            <tr><td>{t('pay.kpi_part')}</td><td>{fmtMoney(row.kpi_part, cur)}</td></tr>
            {Number(row.absence_deduction) > 0 && <tr className="minus"><td>{t('pay.absence')}</td><td>−{fmtMoney(row.absence_deduction, cur)}</td></tr>}
            {Number(row.late_fine) > 0 && <tr className="minus"><td>{t('pay.late_fine')}</td><td>−{fmtMoney(row.late_fine, cur)}</td></tr>}
            {Number(row.early_fine) > 0 && <tr className="minus"><td>{t('pay.early_fine')}</td><td>−{fmtMoney(row.early_fine, cur)}</td></tr>}
            <tr className="total"><td>{t('pay.total')}</td><td>{fmtMoney(row.salary, cur)}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
