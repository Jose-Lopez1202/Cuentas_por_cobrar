import { useState, type FC } from 'react';

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  items: ChartDatum[];
  /** 'donut' deja hueco central con el total; 'pie' rellena el círculo completo. */
  variant?: 'donut' | 'pie';
  valueFormatter?: (value: number) => string;
  /** Texto bajo el total en el centro del donut. */
  centerCaption?: string;
  size?: number;
  emptyText?: string;
}

const defaultFormatter = (value: number) => value.toLocaleString('es-GT');

const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

/** Sector (o anillo) entre dos ángulos, en radianes desde las 12 en punto. */
function arcPath(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const a0 = start - Math.PI / 2;
  const a1 = end - Math.PI / 2;
  const large = end - start > Math.PI ? 1 : 0;
  const o0 = polar(cx, cy, outer, a0);
  const o1 = polar(cx, cy, outer, a1);
  if (inner <= 0) {
    return `M ${cx} ${cy} L ${o0.x} ${o0.y} A ${outer} ${outer} 0 ${large} 1 ${o1.x} ${o1.y} Z`;
  }
  const i0 = polar(cx, cy, inner, a0);
  const i1 = polar(cx, cy, inner, a1);
  return `M ${o0.x} ${o0.y} A ${outer} ${outer} 0 ${large} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${inner} ${inner} 0 ${large} 0 ${i0.x} ${i0.y} Z`;
}

/**
 * Circular de partes de un todo. Cada segmento tiene su etiqueta en la
 * leyenda con valor y porcentaje: la identidad nunca depende solo del color.
 * Al pasar el mouse por un segmento o por su fila de leyenda se resalta y el
 * centro (donut) muestra su valor.
 */
export const DonutChart: FC<DonutChartProps> = ({
  items,
  variant = 'donut',
  valueFormatter = defaultFormatter,
  centerCaption = 'Total',
  size = 168,
  emptyText = 'Sin datos todavía',
}) => {
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (items.length === 0 || total <= 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{emptyText}</p>;
  }

  const cx = size / 2;
  const outer = size / 2 - 4;
  const inner = variant === 'donut' ? outer * 0.62 : 0;

  let cursor = 0;
  const slices = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor;
      const sweep = (item.value / total) * Math.PI * 2;
      cursor += sweep;
      return { item, start, end: cursor, full: sweep >= Math.PI * 2 - 1e-6 };
    });

  const active = items.find((item) => item.key === hover);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Gráfico circular">
          {slices.map(({ item, start, end, full }) => {
            const dim = hover !== null && hover !== item.key;
            const common = {
              fill: item.color,
              stroke: '#ffffff',
              strokeWidth: 2,
              opacity: dim ? 0.35 : 1,
              className: 'transition-opacity duration-150 cursor-pointer',
              onPointerEnter: () => setHover(item.key),
              onPointerLeave: () => setHover(null),
            };
            return full ? (
              <g key={item.key}>
                <circle cx={cx} cy={cx} r={outer} {...common} />
                {inner > 0 && <circle cx={cx} cy={cx} r={inner} fill="#ffffff" />}
              </g>
            ) : (
              <path key={item.key} d={arcPath(cx, cx, outer, inner, start, end)} {...common} />
            );
          })}
        </svg>
        {variant === 'donut' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
            <span className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
              {valueFormatter(active ? active.value : total)}
            </span>
            <span className="text-[10px] font-medium text-slate-400 leading-tight mt-0.5 truncate max-w-full">
              {active ? active.label : centerCaption}
            </span>
          </div>
        )}
      </div>

      <ul className="flex-1 w-full min-w-0 space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center justify-between gap-3 text-xs rounded-md px-2 py-1 transition-colors ${
              hover === item.key ? 'bg-slate-50' : ''
            }`}
            onPointerEnter={() => setHover(item.key)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
              <span className="font-medium text-slate-600 truncate">{item.label}</span>
            </span>
            <span className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-900 tabular-nums">{valueFormatter(item.value)}</span>
              <span className="text-[10px] font-medium text-slate-400 w-8 text-right">
                {Math.round((item.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
