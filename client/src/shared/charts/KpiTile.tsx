import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import { tint } from './colorUtils';

interface KpiTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  caption?: string;
}

/**
 * Tarjeta de KPI: número grande (figuras proporcionales, nunca tabular en un
 * valor exhibido), icono en circulo con tinte del color de acento, y una
 * barra de acento inferior — más presencia que una card plana.
 */
export const KpiTile: FC<KpiTileProps> = ({ label, value, icon: Icon, color, caption }) => (
  <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} aria-hidden="true" />
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: tint(color, 0.12), color }}
      >
        <Icon size={19} strokeWidth={2.25} />
      </div>
    </div>
    <div className="mt-3 text-[26px] leading-tight font-bold text-slate-900 tracking-tight">{value}</div>
    {caption && <p className="mt-1.5 text-xs text-slate-400">{caption}</p>}
  </div>
);
