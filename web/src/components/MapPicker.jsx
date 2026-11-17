import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT = [41.3111, 69.2797] // Toshkent

// Xaritada ishxona nuqtasi va radiusi. Bosilgan joy — yangi nuqta.
export default function MapPicker({ lat, lng, radius, onPick }) {
  const box = useRef(null)
  const map = useRef(null)
  const layers = useRef({})
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
    const has = lat != null && lng != null
    const m = L.map(box.current, { zoomControl: true }).setView(has ? [lat, lng] : DEFAULT, has ? 17 : 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(m)
    m.on('click', (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng))
    map.current = m
    return () => { m.remove(); map.current = null; layers.current = {} }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const m = map.current
    if (!m) return
    const { circle, dot } = layers.current
    if (lat == null || lng == null) return
    const ll = [lat, lng]
    if (circle) {
      circle.setLatLng(ll).setRadius(radius || 100)
      dot.setLatLng(ll)
    } else {
      layers.current.circle = L.circle(ll, {
        radius: radius || 100, color: '#12A39A', weight: 2, dashArray: '6 6', fillColor: '#12A39A', fillOpacity: 0.12,
      }).addTo(m)
      layers.current.dot = L.circleMarker(ll, {
        radius: 8, color: '#fff', weight: 3, fillColor: '#1D3A8A', fillOpacity: 1,
      }).addTo(m)
    }
    if (!m.getBounds().contains(ll)) m.setView(ll, Math.max(m.getZoom(), 16))
  }, [lat, lng, radius])

  return <div ref={box} className="map-box" />
}
