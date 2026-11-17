// Yuzni telefonning o'zida tanish (face-api, TensorFlow.js).
// Modellar /public/models da (~7 MB, kerak bo'lsa yana ~5.6 MB), birinchi marta yuklanadi, keyin brauzer keshida turadi.

let ready = null

export function loadFaceModels() {
  if (!ready) {
    ready = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await faceapi.tf.ready()
      const url = `${import.meta.env.BASE_URL}models`
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ])
      return faceapi
    })().catch((e) => {
      ready = null
      throw Object.assign(new Error('FACE_MODEL'), { cause: e })
    })
  }
  return ready
}

async function blobToCanvas(blob) {
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext('2d').drawImage(bmp, 0, 0)
  bmp.close?.()
  return canvas
}

let ssdReady = null
// Aniqroq (lekin og'irroq, ~5.6 MB) detektor — faqat kichik detektor yuz topolmaganda yuklanadi
function loadSsd(faceapi) {
  if (!ssdReady) ssdReady = faceapi.nets.ssdMobilenetv1.loadFromUri(`${import.meta.env.BASE_URL}models`).catch((e) => { ssdReady = null; throw e })
  return ssdReady
}

// Rasmdagi yuzning 128 ta raqamli "izi". Yuz topilmasa — null.
export async function faceDescriptor(blob) {
  const faceapi = await loadFaceModels()
  const canvas = await blobToCanvas(blob)
  const attempts = [
    () => new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 }),
    () => new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }),
    async () => { await loadSsd(faceapi); return new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }) },
  ]
  for (const makeOptions of attempts) {
    const result = await faceapi.detectSingleFace(canvas, await makeOptions()).withFaceLandmarks().withFaceDescriptor()
    if (result) return Array.from(result.descriptor, (v) => Math.round(v * 1e5) / 1e5)
  }
  return null
}

// Masofa (0 — bir xil) -> o'xshashlik foizi
export const similarity = (distance) => (distance == null ? null : Math.max(0, Math.round((1 - distance) * 100)))
