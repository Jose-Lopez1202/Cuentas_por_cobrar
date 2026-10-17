import type { NivelRiesgo } from '@erp/contracts';

/** Paleta validada (dataviz): categórica en orden fijo, estados y tinta. */
export const COLOR = {
  azul: '#2a78d6',
  naranja: '#eb6834',
  aqua: '#1baf7a',
  violeta: '#6250d6',
  gris: '#898781',
  rejilla: '#e1e0d9',
  eje: '#c3c2b7',
  tinta: '#0b0b0b',
  tintaSecundaria: '#52514e',
  buenoTexto: '#006300',
  critico: '#d03b3b',
} as const;

/** Escala ordinal de un solo tono (del más claro al más oscuro) para tramos de antigüedad. */
export const RAMPA_AZUL = ['#86b6ef', '#5598e7', '#2a78d6', '#184f95', '#104281'];

export const RIESGO: Record<NivelRiesgo, { etiqueta: string; color: string; fondo: string; orden: number }> = {
  CRITICO: { etiqueta: 'Crítico', color: '#d03b3b', fondo: '#fbeaea', orden: 0 },
  ALTO: { etiqueta: 'Alto', color: '#ec835a', fondo: '#fdf0ea', orden: 1 },
  MEDIO: { etiqueta: 'Medio', color: '#fab219', fondo: '#fef6e3', orden: 2 },
  BAJO: { etiqueta: 'Bajo', color: '#0ca30c', fondo: '#e8f6e8', orden: 3 },
};

export const Q = (n: number | null | undefined) =>
  `Q ${(n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Q 1.2 M · Q 345 K · Q 980 (para ejes y tarjetas). */
export function Qc(n: number | null | undefined): string {
  const v = n ?? 0;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `Q ${(v / 1_000_000).toLocaleString('es-GT', { maximumFractionDigits: 1 })} M`;
  if (a >= 10_000) return `Q ${(v / 1_000).toLocaleString('es-GT', { maximumFractionDigits: 1 })} K`;
  return `Q ${v.toLocaleString('es-GT', { maximumFractionDigits: 0 })}`;
}

export const entero = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-GT');
export const pct = (n: number | null | undefined, d = 1) => `${(n ?? 0).toLocaleString('es-GT', { maximumFractionDigits: d })} %`;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 2026-10-17 → 17 oct 2026 (sin pasar por Date para no mover el día por el huso horario). */
export function fechaCorta(iso: string | null | undefined, conAnio = true): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d} ${MESES[m - 1]}${conAnio ? ` ${y}` : ''}`;
}

export interface Variacion {
  /** null cuando no hay base de comparación. */
  porcentaje: number | null;
  direccion: 'sube' | 'baja' | 'igual' | 'nuevo';
}

export function variacion(actual: number, anterior: number): Variacion {
  if (anterior === 0 && actual === 0) return { porcentaje: 0, direccion: 'igual' };
  if (anterior === 0) return { porcentaje: null, direccion: 'nuevo' };
  const p = ((actual - anterior) / Math.abs(anterior)) * 100;
  return { porcentaje: p, direccion: Math.abs(p) < 0.05 ? 'igual' : p > 0 ? 'sube' : 'baja' };
}

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type PresetPeriodo = 'hoy' | '7d' | '30d' | '90d' | 'mes' | 'mesAnt' | 'trim' | 'anio' | 'custom';

export const PRESETS: Array<{ id: PresetPeriodo; etiqueta: string }> = [
  { id: '7d', etiqueta: '7 días' },
  { id: '30d', etiqueta: '30 días' },
  { id: '90d', etiqueta: '90 días' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mesAnt', etiqueta: 'Mes anterior' },
  { id: 'trim', etiqueta: 'Trimestre' },
  { id: 'anio', etiqueta: 'Este año' },
];

export function rangoDePreset(p: PresetPeriodo, hoy = new Date()): { desde: string; hasta: string } {
  const fin = isoLocal(hoy);
  const dias = (n: number) => { const d = new Date(hoy); d.setDate(d.getDate() - (n - 1)); return isoLocal(d); };
  switch (p) {
    case 'hoy': return { desde: fin, hasta: fin };
    case '7d': return { desde: dias(7), hasta: fin };
    case '30d': return { desde: dias(30), hasta: fin };
    case 'mes': return { desde: isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fin };
    case 'mesAnt': return {
      desde: isoLocal(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      hasta: isoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    };
    case 'trim': return { desde: isoLocal(new Date(hoy.getFullYear(), Math.floor(hoy.getMonth() / 3) * 3, 1)), hasta: fin };
    case 'anio': return { desde: isoLocal(new Date(hoy.getFullYear(), 0, 1)), hasta: fin };
    case '90d':
    default: return { desde: dias(90), hasta: fin };
  }
}

export interface PuntoDia { fecha: string; [serie: string]: number | string }

/** Agrupa una serie diaria en semanas o meses cuando el período es largo, para que el gráfico se lea. */
export function agruparSerie<T extends PuntoDia>(serie: T[], claves: string[]): Array<Record<string, number | string>> {
  const modo = serie.length <= 62 ? 'dia' : serie.length <= 200 ? 'semana' : 'mes';
  if (modo === 'dia') return serie.map((p) => ({ ...p, etiqueta: fechaCorta(p.fecha, false) }));
  const grupos = new Map<string, Record<string, number | string>>();
  for (const p of serie) {
    const [y, m, d] = p.fecha.split('-').map(Number);
    let clave: string;
    if (modo === 'mes') clave = `${y}-${String(m).padStart(2, '0')}-01`;
    else {
      const f = new Date(Date.UTC(y, m - 1, d));
      const lunes = new Date(f.getTime() - ((f.getUTCDay() + 6) % 7) * 86_400_000);
      clave = lunes.toISOString().slice(0, 10);
    }
    const g = grupos.get(clave) ?? { fecha: clave, etiqueta: modo === 'mes' ? `${MESES[Number(clave.slice(5, 7)) - 1]} ${clave.slice(0, 4)}` : `Sem. ${fechaCorta(clave, false)}` };
    claves.forEach((c) => { g[c] = Number(g[c] ?? 0) + Number(p[c] ?? 0); });
    grupos.set(clave, g);
  }
  return [...grupos.values()];
}
