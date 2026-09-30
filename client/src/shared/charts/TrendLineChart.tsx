import { useId, useMemo, useState, type FC, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendLineChartProps {
  data: TrendPoint[];
  color?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
  headline?: { title: string; caption: string };
}

const defaultFormatter = (value: number) => value.toLocaleString('es-GT');

const VIEW_WIDTH = 600;
const PADDING_X = 16;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 26;
const GRID_STEPS = 3;

/** Redondea hacia arriba a un número "limpio" para que las líneas guía tengan valores legibles. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Línea de tendencia de una sola serie: un eje, un hue, líneas guía
 * horizontales con valores redondeados, crosshair que sigue el puntero y
 * salta al punto más cercano, marcador >=8px con anillo de superficie. El
 * número grande arriba es el patrón "stat tile + sparkline": el valor actual
 * es el protagonista, la línea es el contexto.
 */
export const TrendLineChart: FC<TrendLineChartProps> = ({
  data,
  color = '#2a78d6',
  valueFormatter = defaultFormatter,
  height = 180,
  headline,
}) => {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const maxValue = useMemo(() => niceMax(Math.max(...data.map((p) => p.value), 1)), [data]);
  const step = data.length > 1 ? (VIEW_WIDTH - PADDING_X * 2) / (data.length - 1) : 0;

  const points = useMemo(
    () =>
      data.map((point, index) => ({
        ...point,
        x: PADDING_X + step * index,
        y: PADDING_TOP + plotHeight - (point.value / maxValue) * plotHeight,
      })),
    [data, step, maxValue, plotHeight],
  );

  if (data.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Sin datos todavía</p>;
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const baseline = PADDING_TOP + plotHeight;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

  const last = data[data.length - 1];
  const previous = data.length > 1 ? data[data.length - 2] : undefined;
  const delta = previous ? last.value - previous.value : undefined;
  const deltaPct = previous && previous.value !== 0 ? (delta! / previous.value) * 100 : undefined;

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    let nearest = 0;
    let bestDistance = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - relativeX);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  };

  const active = hoverIndex ?? points.length - 1;
  const activePoint = points[active];
  const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, i) => {
    const value = (maxValue / GRID_STEPS) * i;
    return { value, y: baseline - (value / maxValue) * plotHeight };
  });

  return (
    <div>
      {headline && (
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-slate-400">{headline.caption}</p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">{headline.title}</p>
          </div>
          {delta !== undefined && deltaPct !== undefined && (
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
              {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(deltaPct).toFixed(1)}% vs. mes anterior
            </span>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        className="w-full cursor-crosshair"
        style={{ height }}
        role="img"
        aria-label="Tendencia mensual"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridLines.map((line) => (
          <g key={line.value}>
            <line x1={PADDING_X} y1={line.y} x2={VIEW_WIDTH - PADDING_X} y2={line.y} stroke="#e1e0d9" strokeWidth={1} />
            <text x={PADDING_X} y={line.y - 4} fontSize={9} className="fill-slate-400">
              {valueFormatter(Math.round(line.value))}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {hoverIndex !== null && (
          <line
            x1={activePoint.x}
            y1={PADDING_TOP}
            x2={activePoint.x}
            y2={baseline}
            stroke="#c3c2b7"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {points.map((point, index) => (
          <g key={point.label}>
            <circle
              cx={point.x}
              cy={point.y}
              r={hoverIndex === index ? 5 : 4}
              fill="#fcfcfb"
              stroke={color}
              strokeWidth={2}
            />
            <text x={point.x} y={height - 8} textAnchor="middle" className="fill-slate-400" fontSize={10}>
              {point.label}
            </text>
          </g>
        ))}

        {hoverIndex !== null && (
          <g>
            <rect
              x={Math.min(Math.max(activePoint.x - 44, 2), VIEW_WIDTH - 90)}
              y={Math.max(activePoint.y - 32, 2)}
              width={88}
              height={24}
              rx={5}
              fill="#0b0b0b"
            />
            <text
              x={Math.min(Math.max(activePoint.x, 46), VIEW_WIDTH - 46)}
              y={Math.max(activePoint.y - 32, 2) + 16}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={11}
              fontWeight={600}
            >
              {valueFormatter(activePoint.value)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
