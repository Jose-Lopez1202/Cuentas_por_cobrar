import { useCallback } from 'react';
import { CalendarRange, Filter, MousePointerClick, RotateCcw, Route, User, UsersRound, X } from 'lucide-react';
import type { CatalogoFiltrosAnalitica, CatalogoOption } from '@erp/contracts';
import { apiClient, buildQueryString } from '../../../../shared/api';
import { useApi } from '../useApi';
import { PRESETS, fechaCorta } from '../format';
import { CLAVES_SELECCION, type ClaveSeleccion, type FiltrosUI } from '../useFiltros';
import { Combobox, type OpcionCombo } from './Combobox';

interface Props {
  filtros: FiltrosUI;
  onChange: (cambios: Partial<FiltrosUI>) => void;
  onLimpiar: () => void;
  mostrarLimpiar: boolean;
  /** Qué filtros tienen sentido en esta pantalla. */
  cobrador?: boolean;
  ruta?: boolean;
  cliente?: boolean;
  /** Texto que aclara a qué datos NO afectan los filtros (ej. la cartera). */
  nota?: string;
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TRAMOS = ['Al corriente', '1 a 30 días', '31 a 60 días', '61 a 90 días', 'Más de 90 días'];
const dateCls = 'h-8 rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-800 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100';

/** Barra de segmentadores (slicers) fija bajo el encabezado, con las selecciones hechas en los gráficos. */
export function FilterBar({ filtros, onChange, onLimpiar, mostrarLimpiar, cobrador = true, ruta = true, cliente = false, nota }: Props) {
  const { data: catalogo } = useApi<CatalogoFiltrosAnalitica>('/cxc/analitica/filtros');
  const hoy = new Date();
  const maxHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const rangoInvalido = filtros.desde > filtros.hasta;

  const buscarClientes = useCallback(
    (texto: string) => apiClient.get<CatalogoOption[]>(`/cxc/catalogos/clientes${buildQueryString({ search: texto })}`, { successMessage: false })
      .then((r): OpcionCombo[] => r.map((c) => ({ valor: String(c.id), etiqueta: c.label }))),
    [],
  );

  const opcCobradores: OpcionCombo[] = catalogo?.cobradores.map((c) => ({ valor: String(c.idEmpleado), etiqueta: c.nombre, detalle: c.codigo ?? undefined })) ?? [];
  const opcRutas: OpcionCombo[] = catalogo?.rutas.map((r) => ({ valor: String(r.idRuta), etiqueta: r.nombre, detalle: r.codigo ?? undefined })) ?? [];

  // Selecciones hechas en los gráficos, con su texto legible.
  const etiquetaSeleccion = (k: ClaveSeleccion): string | null => {
    const v = filtros[k];
    if (v === undefined) return null;
    switch (k) {
      case 'idFormaPago': return `Forma de pago: ${catalogo?.formasPago.find((f) => f.idFormaPago === v)?.nombre ?? `#${v}`}`;
      case 'diaSemana': return `Día: ${DIAS[Number(v) - 1] ?? v}`;
      case 'diaMes': return `Día del mes: ${v}`;
      case 'tramo': return `Antigüedad: ${TRAMOS[Number(v) - 1] ?? v}`;
      case 'baseRuta': return `Zona: ${v}`;
    }
  };
  const chips = CLAVES_SELECCION.map((k) => ({ k, texto: etiquetaSeleccion(k) })).filter((c): c is { k: ClaveSeleccion; texto: string } => c.texto !== null);
  const quitarTodas = () => onChange(Object.fromEntries(CLAVES_SELECCION.map((k) => [k, undefined])) as Partial<FiltrosUI>);

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
          <Combobox
            etiqueta="Cobrador" icono={<User size={14} />} valor={filtros.idEmpleado ? String(filtros.idEmpleado) : undefined}
            opciones={opcCobradores} textoTodos="Todos los cobradores" placeholderBuscar="Buscar cobrador…"
            onCambiar={(v) => onChange({ idEmpleado: v ? Number(v) : undefined })}
          />
        )}

        {ruta && (
          <Combobox
            etiqueta="Ruta" icono={<Route size={14} />} valor={filtros.idRuta ? String(filtros.idRuta) : undefined}
            opciones={opcRutas} textoTodos="Todas las rutas" placeholderBuscar="Buscar ruta o código…"
            onCambiar={(v) => onChange({ idRuta: v ? Number(v) : undefined })}
          />
        )}

        {cliente && (
          <Combobox
            etiqueta="Cliente" icono={<UsersRound size={14} />} ancho="w-[220px]" valor={filtros.idCliente ? String(filtros.idCliente) : undefined}
            etiquetaValor={filtros.nombreCliente} textoTodos="Todos los clientes" placeholderBuscar="Buscar cliente por nombre…"
            buscarRemoto={buscarClientes}
            onCambiar={(v, o) => onChange({ idCliente: v ? Number(v) : undefined, nombreCliente: o?.etiqueta })}
          />
        )}

        {mostrarLimpiar && (
          <button type="button" onClick={onLimpiar} className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-[12px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <RotateCcw size={13} aria-hidden="true" /> Restablecer
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Selección activa en los gráficos">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
            <MousePointerClick size={13} aria-hidden="true" /> Selección
          </span>
          {chips.map((c) => (
            <span key={c.k} className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-0.5 pl-2.5 pr-1 text-[12px] font-medium text-blue-950 ring-1 ring-inset ring-blue-200">
              {c.texto}
              <button type="button" onClick={() => onChange({ [c.k]: undefined })} aria-label={`Quitar selección: ${c.texto}`}
                className="rounded-full p-0.5 text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><X size={12} aria-hidden="true" /></button>
            </span>
          ))}
          {chips.length > 1 && <button type="button" onClick={quitarTodas} className="text-[12px] font-medium text-blue-800 hover:underline">Quitar todas</button>}
          <span className="text-[11.5px] text-slate-500">Todo el tablero se está mostrando solo para esta selección.</span>
        </div>
      )}

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
