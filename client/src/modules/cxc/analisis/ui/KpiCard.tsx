import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { COLOR, variacion } from '../format';

/** Línea mínima de tendencia a todo el ancho de la tarjeta (2 px, sin ejes). */
export function Sparkline({ valores, color = COLOR.azul }: { valores: number[]; color?: string }) {
  if (valores.length < 2 || valores.every((v) => v === 0)) return null;
  const w = 200, h = 28, pad = 3;
  const max = Math.max(...valores), min = Math.min(...valores);
  const rango = max - min || 1;
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * w},${h - pad - ((v - min) / rango) * (h - pad * 2)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} aria-hidden="true" className="block">
      <polyline points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={color} fillOpacity="0.1" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Delta({ actual, anterior, subeEsBueno = true, etiqueta = 'vs. período anterior' }: {
  actual: number; anterior: number; subeEsBueno?: boolean; etiqueta?: string;
}) {
  const v = variacion(actual, anterior);
  if (v.direccion === 'nuevo') {
    return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-600"><Sparkles size={13} aria-hidden="true" /> Sin base de comparación</span>;
  }
  if (v.direccion === 'igual') {
    return <span className="inline-flex items-center gap-1 text-[12px] text-slate-500"><ArrowRight size={13} aria-hidden="true" /> Sin cambio {etiqueta}</span>;
  }
  const bueno = (v.direccion === 'sube') === subeEsBueno;
  const Icono = v.direccion === 'sube' ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: bueno ? COLOR.buenoTexto : COLOR.critico }}>
      <Icono size={14} aria-hidden="true" />
      {Math.abs(v.porcentaje ?? 0).toLocaleString('es-GT', { maximumFractionDigits: 1 })} %
      <span className="sr-only">{v.direccion === 'sube' ? ' más' : ' menos'}</span>
      <span className="font-normal text-slate-500">{etiqueta}</span>
    </span>
  );
}

export interface KpiProps {
  etiqueta: string;
  valor: string;
  /** Comparación contra el período anterior. */
  comparar?: { actual: number; anterior: number; subeEsBueno?: boolean };
  /** Texto de apoyo cuando no hay comparación. */
  nota?: string;
  tendencia?: number[];
  color?: string;
  onClick?: () => void;
}

/** Tarjeta de indicador: etiqueta, cifra grande, variación y tendencia. */
export function KpiCard({ etiqueta, valor, comparar, nota, tendencia, color = COLOR.azul, onClick }: KpiProps) {
  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</p>
        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      </div>
      <p className="mt-2 whitespace-nowrap text-[24px] font-semibold leading-none tracking-tight text-slate-900">{valor}</p>
      <div className="mt-2.5 min-h-[18px]">
        {comparar ? <Delta {...comparar} /> : nota && <p className="text-[12px] leading-snug text-slate-500">{nota}</p>}
      </div>
      {tendencia && <div className="mt-2.5"><Sparkline valores={tendencia} color={color} /></div>}
    </>
  );
  const base = 'rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${base} w-full transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}>{cuerpo}</button>
  ) : (
    <div className={base}>{cuerpo}</div>
  );
}
