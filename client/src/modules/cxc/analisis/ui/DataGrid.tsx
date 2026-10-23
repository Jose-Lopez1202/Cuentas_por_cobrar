import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from 'lucide-react';

export interface Columna<T> {
  id: string;
  encabezado: string;
  /** Valor con el que se ordena (y el que se muestra si no hay `render`). */
  valor: (fila: T) => string | number | null;
  render?: (fila: T) => ReactNode;
  alinear?: 'izq' | 'der' | 'centro';
  ancho?: string;
  /** Texto de ayuda en el encabezado. */
  ayuda?: string;
  /** Se muestra en la fila de totales. */
  total?: (filas: T[]) => ReactNode;
  ordenable?: boolean;
}

interface Props<T> {
  filas: T[];
  columnas: Columna<T>[];
  clave: (fila: T) => string | number;
  onFila?: (fila: T) => void;
  /** Texto accesible de la acción al hacer clic en una fila. */
  etiquetaFila?: (fila: T) => string;
  buscar?: (fila: T) => string;
  placeholderBuscar?: string;
  porPagina?: number;
  vacio?: string;
  ordenInicial?: { id: string; dir: 'asc' | 'desc' };
  cargando?: boolean;
  /** Elementos a la derecha de la búsqueda (por ejemplo, el menú Exportar). */
  herramientas?: ReactNode;
  compacta?: boolean;
}

const alin = { izq: 'text-left', der: 'text-right', centro: 'text-center' } as const;

/** Tabla de datos para tableros: ordenar, buscar, paginar y abrir el detalle de cada fila. */
export function DataGrid<T>({
  filas, columnas, clave, onFila, etiquetaFila, buscar, placeholderBuscar = 'Buscar…', porPagina = 10, vacio = 'No hay datos para mostrar.',
  ordenInicial, cargando, herramientas, compacta,
}: Props<T>) {
  const [texto, setTexto] = useState('');
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState(ordenInicial ?? null);

  const filtradas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return t && buscar ? filas.filter((f) => buscar(f).toLowerCase().includes(t)) : filas;
  }, [filas, texto, buscar]);

  const ordenadas = useMemo(() => {
    if (!orden) return filtradas;
    const col = columnas.find((c) => c.id === orden.id);
    if (!col) return filtradas;
    const m = orden.dir === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      const x = col.valor(a), y = col.valor(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * m;
    });
  }, [filtradas, orden, columnas]);

  const paginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const actual = Math.min(pagina, paginas);
  const visibles = ordenadas.slice((actual - 1) * porPagina, actual * porPagina);
  const hayTotales = columnas.some((c) => c.total);
  const pad = compacta ? 'px-3 py-1.5' : 'px-3 py-2.5';

  const alternar = (id: string) => setOrden((o) => (o?.id === id ? (o.dir === 'asc' ? { id, dir: 'desc' } : null) : { id, dir: 'desc' }));

  return (
    <div className="flex flex-col">
      {(buscar || herramientas) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {buscar ? (
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search" value={texto} placeholder={placeholderBuscar} aria-label={placeholderBuscar}
                onChange={(e) => { setTexto(e.target.value); setPagina(1); }}
                className="h-10 w-full sm:w-80 rounded-md border border-slate-300 bg-white pl-8 pr-2 text-sm outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ) : <span />}
          {herramientas}
        </div>
      )}

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-slate-50">
            <tr>
              {columnas.map((c) => {
                const activa = orden?.id === c.id;
                const ordenable = c.ordenable !== false;
                return (
                  <th
                    key={c.id} scope="col" title={c.ayuda} style={{ width: c.ancho }}
                    aria-sort={activa ? (orden!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`whitespace-nowrap border-b border-slate-200 ${pad} text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${alin[c.alinear ?? 'izq']}`}
                  >
                    {ordenable ? (
                      <button type="button" onClick={() => alternar(c.id)} className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${c.alinear === 'der' ? 'flex-row-reverse' : ''}`}>
                        {c.encabezado}
                        {activa ? (orden!.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />) : <ChevronsUpDown size={12} className="opacity-40" aria-hidden="true" />}
                      </button>
                    ) : c.encabezado}
                  </th>
                );
              })}
              {onFila && <th className="w-8 border-b border-slate-200" aria-hidden="true" />}
            </tr>
          </thead>
          <tbody>
            {cargando && visibles.length === 0 && (
              <tr><td colSpan={columnas.length + (onFila ? 1 : 0)} className="px-3 py-10 text-center text-slate-400">Cargando…</td></tr>
            )}
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={columnas.length + (onFila ? 1 : 0)} className="px-3 py-10 text-center text-slate-500">{texto ? 'Ninguna fila coincide con la búsqueda.' : vacio}</td></tr>
            )}
            {visibles.map((f) => (
              <tr
                key={clave(f)}
                onClick={onFila ? () => onFila(f) : undefined}
                onKeyDown={onFila ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFila(f); } } : undefined}
                tabIndex={onFila ? 0 : undefined}
                role={onFila ? 'button' : undefined}
                aria-label={onFila ? etiquetaFila?.(f) ?? 'Ver detalle' : undefined}
                className={`border-b border-slate-100 last:border-0 ${onFila ? 'group cursor-pointer hover:bg-blue-50/60 focus-visible:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600' : ''}`}
              >
                {columnas.map((c) => (
                  <td key={c.id} className={`${pad} align-middle tabular-nums text-slate-800 ${c.alinear === 'der' ? 'whitespace-nowrap' : ''} ${alin[c.alinear ?? 'izq']}`}>
                    {c.render ? c.render(f) : (c.valor(f) ?? '—')}
                  </td>
                ))}
                {onFila && <td className="pr-2 text-slate-300 group-hover:text-blue-700" aria-hidden="true"><ChevronRight size={15} /></td>}
              </tr>
            ))}
          </tbody>
          {hayTotales && ordenadas.length > 0 && (
            <tfoot className="bg-slate-50">
              <tr>
                {columnas.map((c, i) => (
                  <td key={c.id} className={`border-t border-slate-200 ${pad} text-[12px] font-semibold tabular-nums text-slate-800 ${alin[c.alinear ?? 'izq']}`}>
                    {c.total ? c.total(ordenadas) : i === 0 ? 'Total' : ''}
                  </td>
                ))}
                {onFila && <td className="border-t border-slate-200" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {ordenadas.length > porPagina && (
        <div className="mt-3 flex items-center justify-between text-[12px] text-slate-500">
          <span>{(actual - 1) * porPagina + 1}–{Math.min(actual * porPagina, ordenadas.length)} de {ordenadas.length}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPagina(actual - 1)} disabled={actual <= 1} aria-label="Página anterior" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
            <span className="px-1">Página {actual} de {paginas}</span>
            <button type="button" onClick={() => setPagina(actual + 1)} disabled={actual >= paginas} aria-label="Página siguiente" className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
