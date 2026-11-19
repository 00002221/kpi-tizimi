import { Component } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { AuthLayout } from '../pages/auth/AuthPages.jsx'
import { Button } from './ui.jsx'

function Fallback({ onRetry }) {
  const { t } = useI18n()
  return (
    <AuthLayout title={t('crash.title')} sub={t('crash.text')}>
      <Button onClick={onRetry}>{t('crash.reload')}</Button>
    </AuthLayout>
  )
}

// Kutilmagan xato butun ekranni oq qilib qo'ymasin: tushunarli xabar va qayta yuklash tugmasi
export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.error(err) }
  render() {
    if (this.state.failed) return <Fallback onRetry={() => window.location.reload()} />
    return this.props.children
  }
}
