import { CalendarRange, Filter, RotateCcw, Route, User } from 'lucide-react';
import type { CatalogoFiltrosAnalitica } from '@erp/contracts';
import { useApi } from '../useApi';
import { PRESETS, fechaCorta } from '../format';
import type { FiltrosUI } from '../useFiltros';

interface Props {
  filtros: FiltrosUI;
  onChange: (cambios: Partial<FiltrosUI>) => void;
  onLimpiar: () => void;
  mostrarLimpiar: boolean;
  /** Qué filtros tienen sentido en esta pantalla. */
  cobrador?: boolean;
  ruta?: boolean;
  /** Texto que aclara a qué datos NO afectan los filtros (ej. la cartera). */
  nota?: string;
}

const selectCls = 'h-10 max-w-[220px] rounded-md border border-slate-300 bg-white pl-8 pr-2 text-sm text-slate-800 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
const dateCls = 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100';

/** Barra de segmentadores (slicers) fija bajo el encabezado, como en un tablero de BI. */
export function FilterBar({ filtros, onChange, onLimpiar, mostrarLimpiar, cobrador = true, ruta = true, nota }: Props) {
  const { data: catalogo } = useApi<CatalogoFiltrosAnalitica>('/cxc/analitica/filtros');
  const hoy = new Date();
  const maxHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const rangoInvalido = filtros.desde > filtros.hasta;

  return (
    <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-6 border-b border-slate-200 bg-white px-6 py-2.5" role="search" aria-label="Filtros del tablero">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Filter size={13} aria-hidden="true" /> Filtros
        </span>

        <div role="group" aria-label="Período" className="inline-flex overflow-hidden rounded border border-slate-300 bg-white">
          {PRESETS.map((p) => (
            <button
              key={p.id} type="button" onClick={() => onChange({ preset: p.id })} aria-pressed={filtros.preset === p.id}
              className={`h-8 border-r border-slate-200 px-2.5 text-[12px] font-medium last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${filtros.preset === p.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <CalendarRange size={15} className="text-slate-400" aria-hidden="true" />
          <label className="sr-only" htmlFor="flt-desde">Desde</label>
          <input id="flt-desde" type="date" className={dateCls} value={filtros.desde} max={filtros.hasta || maxHoy}
            onChange={(e) => e.target.value && onChange({ desde: e.target.value })} aria-invalid={rangoInvalido || undefined} />
          <span className="text-xs text-slate-400">a</span>
          <label className="sr-only" htmlFor="flt-hasta">Hasta</label>
          <input id="flt-hasta" type="date" className={dateCls} value={filtros.hasta} min={filtros.desde} max={maxHoy}
            onChange={(e) => e.target.value && onChange({ hasta: e.target.value })} aria-invalid={rangoInvalido || undefined} />
        </div>

        {cobrador && (
          <div className="relative">
            <label className="sr-only" htmlFor="flt-cobrador">Cobrador</label>
            <User size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <select id="flt-cobrador" className={selectCls} value={filtros.idEmpleado ?? ''} onChange={(e) => onChange({ idEmpleado: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Todos los cobradores</option>
              {catalogo?.cobradores.map((c) => <option key={c.idEmpleado} value={c.idEmpleado}>{c.nombre}</option>)}
            </select>
          </div>
        )}

        {ruta && (
          <div className="relative">
            <label className="sr-only" htmlFor="flt-ruta">Ruta</label>
            <Route size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <select id="flt-ruta" className={selectCls} value={filtros.idRuta ?? ''} onChange={(e) => onChange({ idRuta: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">Todas las rutas</option>
              {catalogo?.rutas.map((r) => <option key={r.idRuta} value={r.idRuta}>{r.codigo ? `${r.codigo} · ` : ''}{r.nombre}</option>)}
            </select>
          </div>
        )}

        {mostrarLimpiar && (
          <button type="button" onClick={onLimpiar} className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <RotateCcw size={13} aria-hidden="true" /> Restablecer
          </button>
        )}
      </div>

      {rangoInvalido ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">La fecha inicial no puede ser posterior a la final: ajusta el rango para ver datos.</p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">
          Período: {fechaCorta(filtros.desde)} – {fechaCorta(filtros.hasta)}{nota ? ` · ${nota}` : ''}
        </p>
      )}
    </div>
  );
}
