import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';

export interface OpcionCombo {
  valor: string;
  etiqueta: string;
  /** Texto secundario (por ejemplo, el NIT). */
  detalle?: string;
}

interface Props {
  /** Texto accesible del control. */
  etiqueta: string;
  icono?: ReactNode;
  valor: string | undefined;
  /** Texto mostrado cuando hay una opción elegida y todavía no está en la lista (selección que viene de la URL). */
  etiquetaValor?: string;
  opciones?: OpcionCombo[];
  /** Texto de la opción que quita el filtro ("Todos los cobradores"). */
  textoTodos: string;
  placeholderBuscar?: string;
  /** Búsqueda en el servidor para catálogos grandes (clientes). */
  buscarRemoto?: (texto: string) => Promise<OpcionCombo[]>;
  onCambiar: (valor: string | undefined, opcion?: OpcionCombo) => void;
  ancho?: string;
  /** Permite escribir un texto vacío sin disparar búsquedas (se usa con buscarRemoto). */
  minimoCaracteres?: number;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const MAX_VISIBLES = 100;

/**
 * Lista desplegable con buscador: se abre, se escribe para filtrar y se elige con el mouse o el teclado
 * (flechas, Enter y Escape). Para catálogos grandes busca en el servidor mientras se escribe.
 */
export function Combobox({
  etiqueta, icono, valor, etiquetaValor, opciones = [], textoTodos, placeholderBuscar = 'Buscar…', buscarRemoto, onCambiar, ancho = 'w-[200px]', minimoCaracteres = 0,
}: Props) {
  const id = useId().replace(/:/g, '');
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [activo, setActivo] = useState(0);
  const [remotas, setRemotas] = useState<OpcionCombo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorRemoto, setErrorRemoto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  // Búsqueda remota con pausa para no consultar en cada tecla.
  useEffect(() => {
    if (!abierto || !buscarRemoto) return;
    if (texto.trim().length < minimoCaracteres) { setRemotas([]); setBuscando(false); return; }
    let cancelado = false;
    setBuscando(true);
    setErrorRemoto(false);
    const t = window.setTimeout(() => {
      buscarRemoto(texto.trim())
        .then((r) => { if (!cancelado) setRemotas(r); })
        .catch(() => { if (!cancelado) { setRemotas([]); setErrorRemoto(true); } })
        .finally(() => { if (!cancelado) setBuscando(false); });
    }, 250);
    return () => { cancelado = true; window.clearTimeout(t); };
  }, [texto, abierto, buscarRemoto, minimoCaracteres]);

  const lista = useMemo(() => {
    if (buscarRemoto) return remotas;
    const t = normalizar(texto.trim());
    return t ? opciones.filter((o) => normalizar(`${o.etiqueta} ${o.detalle ?? ''}`).includes(t)) : opciones;
  }, [buscarRemoto, remotas, opciones, texto]);
  const visibles = lista.slice(0, MAX_VISIBLES);
  // La posición 0 es siempre "Todos"; las opciones empiezan en 1.
  const total = visibles.length + 1;

  useEffect(() => { setActivo(0); }, [texto, abierto]);
  useEffect(() => {
    if (!abierto) return;
    entrada.current?.focus();
    const fuera = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) cerrar(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  function cerrar(devolverFoco = true) {
    setAbierto(false);
    setTexto('');
    if (devolverFoco) boton.current?.focus();
  }

  function elegir(i: number) {
    if (i === 0) onCambiar(undefined);
    else { const o = visibles[i - 1]; if (o) onCambiar(o.valor, o); }
    cerrar();
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(total - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); elegir(activo); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
    else if (e.key === 'Tab') cerrar(false);
  }

  useEffect(() => {
    if (!abierto) return;
    document.getElementById(`${id}-opt-${activo}`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, abierto, id]);

  const elegida = valor ? (opciones.find((o) => o.valor === valor)?.etiqueta ?? etiquetaValor ?? valor) : undefined;

  return (
    <div ref={raiz} className={`relative ${ancho}`}>
      <button
        ref={boton} type="button" role="combobox" aria-label={etiqueta} aria-haspopup="listbox" aria-expanded={abierto} aria-controls={`${id}-lista`}
        onClick={() => setAbierto((a) => !a)}
        onKeyDown={(e) => { if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setAbierto(true); } }}
        className={`flex h-8 w-full items-center gap-2 rounded border bg-white px-2.5 text-left text-[13px] outline-none hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600 ${valor ? 'border-blue-700 text-slate-900' : 'border-slate-300 text-slate-600'}`}
      >
        {icono && <span className="shrink-0 text-slate-400" aria-hidden="true">{icono}</span>}
        <span className="min-w-0 flex-1 truncate">{elegida ?? textoTodos}</span>
        {valor
          ? <span role="button" tabIndex={-1} aria-label={`Quitar filtro: ${etiqueta}`} onClick={(e) => { e.stopPropagation(); onCambiar(undefined); }} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"><X size={13} aria-hidden="true" /></span>
          : <ChevronDown size={14} className="shrink-0 text-slate-400" aria-hidden="true" />}
      </button>

      {abierto && (
        <div className="absolute left-0 top-9 z-30 w-[300px] max-w-[90vw] rounded-md border border-slate-200 bg-white shadow-xl">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              ref={entrada} type="text" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={teclas}
              role="searchbox" aria-label={placeholderBuscar} aria-controls={`${id}-lista`} aria-activedescendant={`${id}-opt-${activo}`}
              placeholder={placeholderBuscar} autoComplete="off" spellCheck={false}
              className="h-8 w-full rounded border border-slate-300 pl-8 pr-2 text-[13px] outline-none placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
            />
            {buscando && <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-slate-400" aria-label="Buscando" />}
          </div>
          <ul id={`${id}-lista`} role="listbox" aria-label={etiqueta} className="max-h-64 overflow-y-auto py-1">
            <li
              id={`${id}-opt-0`} role="option" aria-selected={!valor} onMouseEnter={() => setActivo(0)} onClick={() => elegir(0)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] ${activo === 0 ? 'bg-blue-50' : ''} ${!valor ? 'font-semibold text-slate-900' : 'text-slate-600'}`}
            >
              <span className="flex-1">{textoTodos}</span>{!valor && <Check size={14} aria-hidden="true" />}
            </li>
            {visibles.map((o, i) => (
              <li
                key={o.valor} id={`${id}-opt-${i + 1}`} role="option" aria-selected={o.valor === valor}
                onMouseEnter={() => setActivo(i + 1)} onClick={() => elegir(i + 1)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] ${activo === i + 1 ? 'bg-blue-50' : ''} ${o.valor === valor ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
              >
                <span className="min-w-0 flex-1"><span className="block truncate">{o.etiqueta}</span>{o.detalle && <span className="block truncate text-[11.5px] text-slate-500">{o.detalle}</span>}</span>
                {o.valor === valor && <Check size={14} className="shrink-0" aria-hidden="true" />}
              </li>
            ))}
            {!buscando && visibles.length === 0 && (
              <li role="presentation" className="px-3 py-3 text-center text-[12.5px] text-slate-500">
                {errorRemoto ? 'No se pudo buscar. Inténtalo de nuevo.'
                  : buscarRemoto && texto.trim().length < minimoCaracteres ? `Escribe al menos ${minimoCaracteres} letras para buscar.`
                    : 'Sin resultados. Prueba con otra palabra.'}
              </li>
            )}
            {lista.length > MAX_VISIBLES && <li role="presentation" className="px-3 py-2 text-center text-[11.5px] text-slate-500">Mostrando {MAX_VISIBLES} de {lista.length}: escribe para acotar.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
