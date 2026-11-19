import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { validLatLng } from '../lib/geo.js'

const DEFAULT = [41.3111, 69.2797] // Toshkent

// Xaritada ishxona nuqtasi va radiusi. Bosilgan joy — yangi nuqta.
export default function MapPicker({ lat: rawLat, lng: rawLng, radius, onPick }) {
  // Maydonga yozilayotgan chala son («4», «-», «») xaritani buzmasin: faqat to'g'ri koordinata chiziladi
  const lat = rawLat === '' || rawLat == null ? NaN : Number(String(rawLat).replace(',', '.'))
  const lng = rawLng === '' || rawLng == null ? NaN : Number(String(rawLng).replace(',', '.'))
  const has = validLatLng(lat, lng)
  const box = useRef(null)
  const map = useRef(null)
  const layers = useRef({})
  const pickRef = useRef(onPick)
  pickRef.current = onPick

  useEffect(() => {
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
    if (!has) return
    const ll = [lat, lng]
    if (circle) {
      circle.setLatLng(ll).setRadius(radius || 100)
      dot.setLatLng(ll)
    } else {
      layers.current.circle = L.circle(ll, {
        radius: radius || 100, color: '#138A5E', weight: 2, dashArray: '6 6', fillColor: '#138A5E', fillOpacity: 0.12,
      }).addTo(m)
      layers.current.dot = L.circleMarker(ll, {
        radius: 8, color: '#fff', weight: 3, fillColor: '#23255C', fillOpacity: 1,
      }).addTo(m)
    }
    if (!m.getBounds().contains(ll)) m.setView(ll, Math.max(m.getZoom(), 16))
  }, [has, lat, lng, radius])

  return <div ref={box} className="map-box" />
}
