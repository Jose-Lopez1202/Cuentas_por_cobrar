import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface RutaMapPoint {
  id: number;
  lat: number;
  lon: number;
  label: string;
  orden?: number;
}

interface RutaMapProps {
  points?: RutaMapPoint[];
  selectedId?: number;
  onSelect?: (id: number) => void;
  /** Modo selección: un clic en el mapa fija la ubicación. */
  pick?: { lat: number; lon: number } | null;
  onPick?: (lat: number, lon: number) => void;
  heightClass?: string;
}

const GUATEMALA: L.LatLngExpression = [14.6349, -90.5069];

const pin = (text: string, active: boolean) => L.divIcon({
  className: '',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 13px system-ui;color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);background:${active ? '#dc2626' : '#2563eb'}">${text}</div>`,
});

/** Mapa OpenStreetMap interactivo (Leaflet): paradas numeradas o selección de punto por clic. */
export function RutaMap({ points = [], selectedId, onSelect, pick, onPick, heightClass = 'h-80' }: RutaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  onPickRef.current = onPick;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(GUATEMALA, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; Colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    // El contenedor puede montarse dentro de un modal con animación: recalcula el tamaño.
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => { window.clearTimeout(timer); map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];

    points.forEach((p) => {
      const active = p.id === selectedId;
      L.marker([p.lat, p.lon], { icon: pin(String(p.orden ?? ''), active), zIndexOffset: active ? 1000 : 0, title: p.label })
        .on('click', () => onSelectRef.current?.(p.id))
        .bindTooltip(p.label)
        .addTo(layer);
      bounds.push([p.lat, p.lon]);
    });
    if (pick) {
      L.marker([pick.lat, pick.lon], { icon: pin('★', true) }).addTo(layer);
      bounds.push([pick.lat, pick.lon]);
    }

    const selected = points.find((p) => p.id === selectedId);
    if (selected) map.setView([selected.lat, selected.lon], Math.max(map.getZoom(), 15));
    else if (pick) map.setView([pick.lat, pick.lon], Math.max(map.getZoom(), 15));
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    else if (bounds.length === 1) map.setView(bounds[0], 15);
  }, [points, selectedId, pick]);

  return <div ref={containerRef} className={`w-full ${heightClass} rounded-lg border border-slate-300 z-0`} role="application" aria-label="Mapa de ubicaciones" />;
}
