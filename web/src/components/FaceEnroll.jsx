import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useI18n } from '../i18n/index.jsx'
import { Alert, Button, useToast } from './ui.jsx'
import CameraCapture from './CameraCapture.jsx'
import { faceDescriptor, loadFaceModels } from '../lib/face.js'
import { errorText } from '../lib/utils.js'

// Xodimning bir martalik yuz namunasini olish (rozilik bilan)
export default function FaceEnroll({ onDone }) {
  const { t } = useI18n()
  const { member } = useAuth()
  const toast = useToast()
  const [consent, setConsent] = useState(false)
  const [phase, setPhase] = useState('idle') // idle | camera | processing
  const [error, setError] = useState(null)

  useEffect(() => { loadFaceModels().catch(() => {}) }, [])

  const onCapture = async (blob) => {
    setPhase('processing')
    setError(null)
    try {
      const descriptor = await faceDescriptor(blob)
      if (!descriptor) throw new Error('FACE_NOT_FOUND')
      const path = `${member.company_id}/${member.user_id}/face-${Date.now()}.jpg`
      const up = await supabase.storage.from('selfies').upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const { error } = await supabase.rpc('enroll_face', { p_descriptor: descriptor, p_photo: path, p_consent: true })
      if (error) throw error
      toast(t('face.enrolled_ok'))
      onDone?.()
    } catch (e) {
      setError(errorText(e, t))
    }
    setPhase('idle')
  }

  return (
    <section className="panel face-enroll">
      <h2>{t('face.enroll_title')}</h2>
      <p className="muted">{t('face.enroll_text')}</p>
      <label className="consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{t('face.consent')}</span>
      </label>
      {error && <Alert kind="error">{error}</Alert>}
      <Button size="xl" disabled={!consent} loading={phase === 'processing'} onClick={() => setPhase('camera')}>
        {phase === 'processing' ? t('face.processing') : t('face.enroll_btn')}
      </Button>
      <CameraCapture open={phase === 'camera'} onClose={() => setPhase('idle')} onCapture={onCapture} />
    </section>
  )
}
