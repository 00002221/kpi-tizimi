import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { Button, Modal } from './ui.jsx'

// Jonli kameradan selfi olish. Kamera ochilmasa — telefon kamerasini ochadigan fayl tanlash.
export default function CameraCapture({ open, onClose, onCapture }) {
  const { t } = useI18n()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(null)
  const [shot, setShot] = useState(null) // { blob, url }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    setShot(null)
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

  const take = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const size = Math.min(v.videoWidth, v.videoHeight)
    const out = Math.min(640, size)
    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    ctx.translate(out, 0)
    ctx.scale(-1, 1) // oynadagidek ko'rinish
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, out, out)
    canvas.toBlob((blob) => blob && setShot({ blob, url: URL.createObjectURL(blob) }), 'image/jpeg', 0.82)
  }

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (f) setShot({ blob: f, url: URL.createObjectURL(f) })
  }

  const confirm = () => {
    if (shot) onCapture(shot.blob)
  }

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
        ) : !error ? (
          <Button onClick={take}>{t('selfie.take')}</Button>
        ) : null
      }
    >
      <p className="muted">{t('selfie.hint')}</p>
      <div className="camera-frame">
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
    </Modal>
  )
}
