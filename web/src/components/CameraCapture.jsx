import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { Button, Modal } from './ui.jsx'
import { faceDescriptor, faceInVideo, loadFaceModels } from '../lib/face.js'

// Jonli kameradan selfi olish. Kamera ochilmasa — telefon kamerasini ochadigan fayl tanlash.
// requireFace: kadrda yuz bo'lmaguncha suratga olib bo'lmaydi, olingan rasmda ham yuz bo'lishi shart.
// onCapture(blob, descriptor) — descriptor faqat requireFace bo'lsa (128 son).
export default function CameraCapture({ open, onClose, onCapture, requireFace = false }) {
  const { t } = useI18n()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(null)
  const [shot, setShot] = useState(null) // { blob, url, descriptor }
  const [face, setFace] = useState('loading') // loading | none | ok | model_err
  const [checking, setChecking] = useState(false)
  const [noFace, setNoFace] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setShot(null)
    setNoFace(false)
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false,
        })
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop())
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
      streamRef.current = null
    }
  }, [open])

  // Kadrda yuz bormi — har ~0.4 soniyada tekshiramiz
  useEffect(() => {
    if (!open || !requireFace || shot || error) return
    let stop = false
    let timer
    setFace('loading')
    loadFaceModels().then(() => {
      const tick = async () => {
        if (stop) return
        try {
          const ok = await faceInVideo(videoRef.current)
          if (!stop) setFace(ok ? 'ok' : 'none')
        } catch { if (!stop) setFace('none') }
        if (!stop) timer = setTimeout(tick, 400)
      }
      tick()
    }).catch(() => { if (!stop) setFace('model_err') })
    return () => { stop = true; clearTimeout(timer) }
  }, [open, requireFace, shot, error, retry])

  const accept = async (blob) => {
    if (!requireFace) return setShot({ blob, url: URL.createObjectURL(blob) })
    setChecking(true)
    setNoFace(false)
    let d = null
    try { d = await faceDescriptor(blob) } catch { setFace('model_err') }
    setChecking(false)
    if (!d) return setNoFace(true)
    setShot({ blob, url: URL.createObjectURL(blob), descriptor: d })
  }

  const take = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    if (requireFace && face !== 'ok') return
    const size = Math.min(v.videoWidth, v.videoHeight)
    const out = Math.min(640, size)
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    ctx.translate(out, 0)
    ctx.scale(-1, 1) // oynadagidek ko'rinish
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, out, out)
    canvas.toBlob((blob) => blob && accept(blob), 'image/jpeg', 0.82)
  }

  const onFile = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) accept(f)
  }

  const confirm = () => {
    if (shot) onCapture(shot.blob, shot.descriptor ?? null)
  }

  const status = !requireFace || shot || error ? null
    : face === 'model_err' ? 'model_err'
    : checking ? 'checking'
    : noFace ? 'no_face'
    : face
  const statusText = {
    loading: t('selfie.face_loading'),
    none: t('selfie.face_wait'),
    ok: t('selfie.face_ok'),
    checking: t('face.processing'),
    no_face: t('err.FACE_NOT_FOUND'),
    model_err: t('err.FACE_MODEL'),
  }[status]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('selfie.title')}
      footer={
        shot ? (
          <>
            <Button variant="ghost" onClick={() => setShot(null)}>{t('selfie.retake')}</Button>
            <Button onClick={confirm}>{t('selfie.use')}</Button>
          </>
        ) : status === 'model_err' ? (
          <Button onClick={() => setRetry((n) => n + 1)}>{t('common.retry')}</Button>
        ) : !error ? (
          <Button onClick={take} disabled={requireFace && face !== 'ok'} loading={checking}>{t('selfie.take')}</Button>
        ) : null
      }
    >
      <p className="muted">{t('selfie.hint')}</p>
      <div className={'camera-frame' + (status === 'ok' ? ' face-ok' : status === 'none' || status === 'no_face' ? ' face-none' : '')}>
        {shot ? (
          <img src={shot.url} alt="" />
        ) : error ? (
          <div className="camera-fallback">
            <p>{t('selfie.no_camera')}</p>
            <label className="btn btn-primary">
              {t('selfie.open_camera')}
              <input type="file" accept="image/*" capture="user" onChange={onFile} hidden />
            </label>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="mirror" />
        )}
      </div>
      {statusText && (
        <p className={'face-status ' + (status === 'ok' ? 'is-ok' : status === 'loading' || status === 'checking' ? '' : 'is-bad')} role="status" aria-live="polite">
          {statusText}
        </p>
      )}
      {error && noFace && <p className="face-status is-bad" role="alert">{t('err.FACE_NOT_FOUND')}</p>}
    </Modal>
  )
}
