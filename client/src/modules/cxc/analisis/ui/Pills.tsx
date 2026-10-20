import { AlertOctagon, AlertTriangle, CheckCircle2, CircleAlert, Info } from 'lucide-react';
import type { NivelRiesgo, SeveridadAlerta } from '@erp/contracts';
import { RIESGO } from '../format';

const ICONO_RIESGO = { CRITICO: AlertOctagon, ALTO: AlertTriangle, MEDIO: CircleAlert, BAJO: CheckCircle2 } as const;

/** Nivel de riesgo: color + ícono + texto (nunca solo color). */
export function RiesgoPill({ nivel, score }: { nivel: NivelRiesgo; score?: number }) {
  const r = RIESGO[nivel];
  const Icono = ICONO_RIESGO[nivel];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-slate-800" style={{ backgroundColor: r.fondo, boxShadow: `inset 0 0 0 1px ${r.color}55` }}>
      <Icono size={13} style={{ color: r.color }} aria-hidden="true" />
      {r.etiqueta}{score !== undefined && <span className="font-normal text-slate-600"> · {score}</span>}
    </span>
  );
}

const TONOS: Record<string, string> = {
  PENDIENTE: 'bg-amber-50 text-amber-900 ring-amber-200',
  PARCIAL: 'bg-amber-50 text-amber-900 ring-amber-200',
  VENCIDO: 'bg-red-50 text-red-800 ring-red-200',
  INCUMPLIDA: 'bg-red-50 text-red-800 ring-red-200',
  INCUMPLIDO: 'bg-red-50 text-red-800 ring-red-200',
  NO_ENCONTRADO: 'bg-red-50 text-red-800 ring-red-200',
  PAGADO: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  CUMPLIDA: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  CUMPLIDO: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  VISITADO: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  COMPLETADA: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ACTIVO: 'bg-blue-50 text-blue-800 ring-blue-200',
  APLICADO: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export const etiquetaEstado = (e: string | null | undefined) =>
  e ? e.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—';

export function EstadoPill({ estado }: { estado: string | null | undefined }) {
  const tono = (estado && TONOS[estado]) || 'bg-slate-100 text-slate-700 ring-slate-200';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ${tono}`}>{etiquetaEstado(estado)}</span>;
}

const SEVERIDAD: Record<SeveridadAlerta, { cls: string; icono: typeof Info; etiqueta: string }> = {
  critica: { cls: 'border-red-200 bg-red-50', icono: AlertOctagon, etiqueta: 'Crítica' },
  alta: { cls: 'border-orange-200 bg-orange-50', icono: AlertTriangle, etiqueta: 'Alta' },
  media: { cls: 'border-amber-200 bg-amber-50', icono: CircleAlert, etiqueta: 'Media' },
  info: { cls: 'border-blue-200 bg-blue-50', icono: Info, etiqueta: 'Informativa' },
};
const COLOR_SEV: Record<SeveridadAlerta, string> = { critica: '#d03b3b', alta: '#ec835a', media: '#b7791f', info: '#2a78d6' };

export function AlertaItem({ severidad, titulo, detalle, onClick }: { severidad: SeveridadAlerta; titulo: string; detalle: string; onClick?: () => void }) {
  const s = SEVERIDAD[severidad];
  const Icono = s.icono;
  const cuerpo = (
    <>
      <Icono size={17} className="mt-0.5 shrink-0" style={{ color: COLOR_SEV[severidad] }} aria-hidden="true" />
      <div className="min-w-0 text-left">
        <p className="text-[13px] font-semibold text-slate-900">{titulo} <span className="ml-1 text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{s.etiqueta}</span></p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-slate-600">{detalle}</p>
      </div>
    </>
  );
  const cls = `flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 ${s.cls}`;
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}>{cuerpo}</button>
    : <div className={cls}>{cuerpo}</div>;
}

/** Barra de progreso con pista del mismo tono (medidor). */
export function Medidor({ valor, max = 100, color = '#2a78d6', etiqueta }: { valor: number; max?: number; color?: string; etiqueta?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2" role="meter" aria-valuenow={Math.round(valor)} aria-valuemin={0} aria-valuemax={max} aria-label={etiqueta}>
      <div className="h-1.5 w-full min-w-[56px] overflow-hidden rounded-full" style={{ backgroundColor: `${color}26` }}>
        <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
