'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Place {
  placeId: string
  name: string
  address: string
  phone: string
  website: string
  rating: number | null
  lat: number | null
  lng: number | null
  score: number
}

function scoreColor(score: number) {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function makeIcon(score: number) {
  const color = scoreColor(score)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <ellipse cx="14" cy="34" rx="5" ry="2" fill="rgba(0,0,0,0.2)"/>
    <path d="M14 0C8.477 0 4 4.477 4 10c0 7 10 24 10 24S24 17 24 10C24 4.477 19.523 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="10" r="5" fill="white"/>
    <text x="14" y="13.5" text-anchor="middle" font-size="7" font-weight="bold" fill="${color}">${score}</text>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  })
}

export default function ResultsMap({ places }: { places: Place[] }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const withCoords = places.filter(p => p.lat !== null && p.lng !== null)
  const center: [number, number] = withCoords.length > 0
    ? [withCoords[0].lat!, withCoords[0].lng!]
    : [4.5709, -74.2973]

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} className="rounded-xl">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withCoords.map(p => (
        <Marker key={p.placeId} position={[p.lat!, p.lng!]} icon={makeIcon(p.score)}>
          <Popup>
            <div className="text-sm space-y-1 min-w-[160px]">
              <p className="font-semibold">{p.name}</p>
              {p.address && <p className="text-[#7f8a9c] text-xs">{p.address}</p>}
              {p.phone && <p className="text-xs">📞 {p.phone}</p>}
              {p.rating && <p className="text-xs">⭐ {p.rating}/5</p>}
              <div className="flex items-center gap-1 pt-1">
                <span className="text-xs font-bold" style={{ color: scoreColor(p.score) }}>Score: {p.score}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
