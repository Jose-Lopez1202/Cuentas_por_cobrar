import type { FC } from 'react';
import type { ChartDatum } from './DonutChart';

interface StackedBarProps {
  items: ChartDatum[];
  valueFormatter?: (value: number) => string;
  emptyText?: string;
}

const defaultFormatter = (value: number) => value.toLocaleString('es-GT');

/**
 * Barra apilada al 100%: una sola barra segmentada que muestra de un vistazo
 * cómo se reparte un total. Leyenda debajo con valor y porcentaje.
 */
export const StackedBar: FC<StackedBarProps> = ({
  items,
  valueFormatter = defaultFormatter,
  emptyText = 'Sin datos todavía',
}) => {
  const visible = items.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);

  if (total <= 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{emptyText}</p>;
  }

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 gap-0.5" role="img" aria-label="Distribución porcentual">
        {visible.map((item) => (
          <div
            key={item.key}
            className="h-full transition-[flex-grow] duration-500 hover:brightness-110 first:rounded-l-full last:rounded-r-full"
            style={{ flexGrow: item.value, flexBasis: 0, backgroundColor: item.color }}
            title={`${item.label}: ${valueFormatter(item.value)} (${Math.round((item.value / total) * 100)}%)`}
          />
        ))}
      </div>

      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 text-xs">
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
