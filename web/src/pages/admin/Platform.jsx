import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Alert, Button, Empty, PageHeader, Spinner, Tabs, useConfirm, useToast } from '../../components/ui.jsx'
import { errorText, fmtDate } from '../../lib/utils.js'

// Platforma egasi: yangi kompaniyalarni tasdiqlaydi yoki rad etadi
export default function Platform() {
  const { t } = useI18n()
  const { company: mine } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('pending')
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('platform_companies')
    setError(error ? errorText(error, t) : null)
    setRows(data || [])
  }, [t])
  useEffect(() => { load() }, [load])

  const setStatus = async (c, status, ask) => {
    if (ask && !await confirm(ask)) return
    setBusy(c.id)
    const { error } = await supabase.rpc('platform_set_company_status', { p_company: c.id, p_status: status })
    setBusy(null)
    if (error) return toast(errorText(error, t), 'error')
    toast(t(status === 'active' ? 'plat.approved' : 'plat.rejected_done', { name: c.name }))
    load()
  }

  if (!rows) return <Spinner />
  const groups = {
    pending: rows.filter((c) => c.status === 'pending'),
    active: rows.filter((c) => c.status === 'active'),
    rejected: rows.filter((c) => c.status === 'rejected'),
  }
  const list = groups[tab]

  return (
    <div className="stack-lg">
      <PageHeader title={t('nav.platform')} sub={t('plat.sub')} />
      {error && <Alert kind="error">{error}</Alert>}
      <Tabs value={tab} onChange={setTab} items={[
        { value: 'pending', label: t('plat.tab_pending'), count: groups.pending.length },
        { value: 'active', label: t('plat.tab_active'), count: groups.active.length },
        { value: 'rejected', label: t('plat.tab_rejected'), count: groups.rejected.length },
      ]} />
      {list.length === 0 ? <Empty title={tab === 'pending' ? t('plat.empty_pending') : t('plat.empty')} /> : (
        <div className="m-list plat-list">
          {list.map((c) => {
            const own = c.id === mine?.id
            return (
              <div key={c.id} className="m-card m-card-col">
                <div className="m-card-row">
                  <div className="m-card-main">
                    <div className="m-card-title">{c.name}{own && <span className="tag" style={{ marginLeft: 8 }}>{t('plat.yours')}</span>}</div>
                    <div className="m-card-sub">{[c.owner_name, c.owner_phone].filter(Boolean).join(', ')}</div>
                    <div className="m-card-sub">{c.owner_email}</div>
                  </div>
                </div>
                <div className="m-card-facts">
                  <span>{t('plat.created')} <b>{fmtDate(c.created_at)}</b></span>
                  <span>{t('plat.members')} <b>{c.members}</b></span>
                  {c.status === 'active' && <span>{t('plat.last_activity')} <b>{c.last_activity ? fmtDate(c.last_activity) : '—'}</b></span>}
                </div>
                {!own && (
                  <div className="m-card-actions">
                    {c.status === 'pending' && <>
                      <Button loading={busy === c.id} onClick={() => setStatus(c, 'active')}>{t('plat.approve')}</Button>
                      <Button variant="danger-ghost" onClick={() => setStatus(c, 'rejected', t('plat.reject_confirm', { name: c.name }))}>{t('plat.reject')}</Button>
                    </>}
                    {c.status === 'active' && (
                      <Button variant="danger-ghost" onClick={() => setStatus(c, 'rejected', t('plat.block_confirm', { name: c.name }))}>{t('plat.block')}</Button>
                    )}
                    {c.status === 'rejected' && (
                      <Button variant="secondary" loading={busy === c.id} onClick={() => setStatus(c, 'active')}>{t('plat.restore')}</Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
