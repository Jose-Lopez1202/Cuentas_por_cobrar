import { useState, type FC } from 'react';
import type { ChartDatum } from './DonutChart';

interface VerticalBarChartProps {
  items: ChartDatum[];
  valueFormatter?: (value: number) => string;
  height?: number;
  emptyText?: string;
}

const defaultFormatter = (value: number) => value.toLocaleString('es-GT');

const VIEW_WIDTH = 600;
const PADDING_X = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 30;
const GRID_STEPS = 3;
const MAX_LABEL_CHARS = 12;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

const shorten = (label: string) => (label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label);

/**
 * Columnas para comparar magnitud entre pocas categorías. Base cuadrada,
 * extremo superior redondeado, ancho limitado ("cap it - never fill the
 * slot"), líneas guía con valores redondeados y tooltip al pasar el mouse.
 */
export const VerticalBarChart: FC<VerticalBarChartProps> = ({
  items,
  valueFormatter = defaultFormatter,
  height = 200,
  emptyText = 'Sin datos todavía',
}) => {
  const [hover, setHover] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{emptyText}</p>;
  }

  const plotHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const baseline = PADDING_TOP + plotHeight;
  const maxValue = niceMax(Math.max(...items.map((item) => item.value), 1));
  const slot = (VIEW_WIDTH - PADDING_X * 2) / items.length;
  const barWidth = Math.min(slot * 0.55, 44);

  const gridLines = Array.from({ length: GRID_STEPS + 1 }, (_, i) => {
    const value = (maxValue / GRID_STEPS) * i;
    return { value, y: baseline - (value / maxValue) * plotHeight };
  });

  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${height}`} className="w-full" style={{ height }} role="img" aria-label="Gráfico de columnas">
      {gridLines.map((line) => (
        <g key={line.value}>
          <line x1={PADDING_X} y1={line.y} x2={VIEW_WIDTH - PADDING_X} y2={line.y} stroke="#e1e0d9" strokeWidth={1} />
          <text x={PADDING_X} y={line.y - 4} fontSize={9} className="fill-slate-400">
            {valueFormatter(Math.round(line.value))}
          </text>
        </g>
      ))}

      {items.map((item, index) => {
        const h = Math.max((item.value / maxValue) * plotHeight, item.value > 0 ? 3 : 0);
        const x = PADDING_X + slot * index + (slot - barWidth) / 2;
        const y = baseline - h;
        const r = Math.min(4, h);
        const isHover = hover === item.key;
        const tipWidth = 92;
        const tipX = Math.min(Math.max(x + barWidth / 2 - tipWidth / 2, 2), VIEW_WIDTH - tipWidth - 2);
        const tipY = Math.max(y - 30, 2);

        return (
          <g
            key={item.key}
            onPointerEnter={() => setHover(item.key)}
            onPointerLeave={() => setHover(null)}
            className="cursor-pointer"
          >
            {/* Área de captura completa de la columna para un hover cómodo. */}
            <rect x={PADDING_X + slot * index} y={PADDING_TOP} width={slot} height={plotHeight + PADDING_BOTTOM} fill="transparent" />
            <path
              d={`M ${x} ${baseline} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + barWidth - r} ${y} Q ${x + barWidth} ${y} ${x + barWidth} ${y + r} L ${x + barWidth} ${baseline} Z`}
              fill={item.color}
              opacity={hover !== null && !isHover ? 0.45 : 1}
              className="transition-opacity duration-150"
            />
            <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize={10} className="fill-slate-500">
              {shorten(item.label)}
              <title>{item.label}</title>
            </text>
            {isHover && (
              <g pointerEvents="none">
                <rect x={tipX} y={tipY} width={tipWidth} height={22} rx={5} fill="#0b0b0b" />
                <text x={tipX + tipWidth / 2} y={tipY + 15} textAnchor="middle" fill="#ffffff" fontSize={11} fontWeight={600}>
                  {valueFormatter(item.value)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
