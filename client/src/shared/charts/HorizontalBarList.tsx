import type { FC } from 'react';

export interface HorizontalBarItem {
  key: string;
  label: string;
  value: number;
  secondaryValue?: number;
  color: string;
}

interface HorizontalBarListProps {
  items: HorizontalBarItem[];
  valueFormatter?: (value: number) => string;
  secondaryFormatter?: (value: number) => string;
  emptyText?: string;
}

const defaultFormatter = (value: number) => value.toLocaleString('es-GT');

/**
 * Barras horizontales para comparar magnitud entre categorías (estado, tipo
 * de gestión...). Extremo de dato redondeado (4px), cuadrado en la base,
 * <=10px de grosor ("cap it - never fill the slot"). Cada fila ya trae su
 * propia etiqueta de texto: la identidad nunca depende solo del color.
 * Tooltip por hover en cada barra (el mark es el hit target), fila que se
 * eleva levemente al pasar el mouse.
 */
export const HorizontalBarList: FC<HorizontalBarListProps> = ({
  items,
  valueFormatter = defaultFormatter,
  secondaryFormatter,
  emptyText = 'Sin datos todavía',
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{emptyText}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const widthPct = Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0);
        const percentOfTotal = total > 0 ? Math.round((item.value / total) * 100) : 0;

        return (
          <li key={item.key} className="group relative -mx-2 px-2 py-1 rounded-lg transition-colors hover:bg-slate-50">
            <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
              <span className="font-medium text-slate-600 truncate">{item.label}</span>
              <span className="flex items-baseline gap-1.5 shrink-0">
                <span className="font-bold text-slate-900 tabular-nums">{valueFormatter(item.value)}</span>
                {total > 0 && <span className="text-[10px] font-medium text-slate-400">{percentOfTotal}%</span>}
              </span>
            </div>

            <div className="h-[9px] bg-slate-100 relative" style={{ borderRadius: '0 4px 4px 0' }}>
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out group-hover:brightness-110"
                style={{ width: `${widthPct}%`, backgroundColor: item.color, borderRadius: '0 4px 4px 0' }}
              />
            </div>

            {secondaryFormatter && item.secondaryValue !== undefined && (
              <div
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-1 -translate-y-full hidden group-hover:flex items-center gap-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg z-10"
              >
                <span className="w-2 h-0.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                {secondaryFormatter(item.secondaryValue)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
