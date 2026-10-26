import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRESETS, rangoDePreset, type PresetPeriodo } from './format';

export interface FiltrosUI {
  preset: PresetPeriodo;
  desde: string;
  hasta: string;
  idEmpleado?: number;
  idRuta?: number;
  idCliente?: number;
  /** Nombre del cliente elegido (viaja en la URL para poder mostrarlo sin consultar). */
  nombreCliente?: string;
  /** Selecciones hechas con un clic en un gráfico (filtrado cruzado). */
  idFormaPago?: number;
  diaSemana?: number;
  diaMes?: number;
  tramo?: number;
  baseRuta?: string;
}

/** Claves de las selecciones cruzadas (las que se muestran como "chips" y se pueden quitar de una vez). */
export const CLAVES_SELECCION = ['idFormaPago', 'diaSemana', 'diaMes', 'tramo', 'baseRuta'] as const;
export type ClaveSeleccion = (typeof CLAVES_SELECCION)[number];

const PRESETS_VALIDOS = new Set<string>([...PRESETS.map((p) => p.id), 'custom', 'hoy']);
const num = (v: string | null, max = Infinity) => { const n = Number(v); return v && Number.isInteger(n) && n > 0 && n <= max ? n : undefined; };
const esIso = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

// Nombre de cada filtro en la URL.
const URL_KEY: Record<string, string> = {
  idEmpleado: 'e', idRuta: 'r', idCliente: 'c', nombreCliente: 'cn', idFormaPago: 'f', diaSemana: 'w', diaMes: 'm', tramo: 't', baseRuta: 'z',
};

/**
 * Los filtros viven en la URL (?p=90d&e=3&f=2&t=3): se pueden compartir o guardar el enlace,
 * y al volver atrás el tablero queda igual. Incluye las selecciones de los gráficos.
 */
export function useFiltros(presetInicial: PresetPeriodo = '90d') {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo<FiltrosUI>(() => {
    const p = params.get('p');
    const preset = (p && PRESETS_VALIDOS.has(p) ? p : presetInicial) as PresetPeriodo;
    const base = rangoDePreset(preset === 'custom' ? presetInicial : preset);
    const desde = preset === 'custom' && esIso(params.get('d')) ? params.get('d')! : base.desde;
    const hasta = preset === 'custom' && esIso(params.get('h')) ? params.get('h')! : base.hasta;
    return {
      preset, desde, hasta,
      idEmpleado: num(params.get('e')), idRuta: num(params.get('r')), idCliente: num(params.get('c')),
      nombreCliente: params.get('cn') ?? undefined,
      idFormaPago: num(params.get('f')), diaSemana: num(params.get('w'), 7), diaMes: num(params.get('m'), 31), tramo: num(params.get('t'), 5),
      baseRuta: params.get('z')?.slice(0, 150) || undefined,
    };
  }, [params, presetInicial]);

  const cambiar = useCallback((cambios: Partial<FiltrosUI>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const set = (k: string, v: string | number | undefined) => { if (v === undefined || v === '') next.delete(k); else next.set(k, String(v)); };
      if ('preset' in cambios) {
        set('p', cambios.preset);
        if (cambios.preset !== 'custom') { next.delete('d'); next.delete('h'); }
      }
      if ('desde' in cambios) { set('d', cambios.desde); set('p', 'custom'); }
      if ('hasta' in cambios) { set('h', cambios.hasta); set('p', 'custom'); }
      if (cambios.preset === 'custom' && !('desde' in cambios)) { set('d', filtros.desde); set('h', filtros.hasta); }
      (Object.keys(URL_KEY) as Array<keyof typeof URL_KEY>).forEach((k) => {
        if (k in cambios) set(URL_KEY[k], cambios[k as keyof FiltrosUI] as string | number | undefined);
      });
      // Si se quita el cliente, también se olvida su nombre.
      if ('idCliente' in cambios && cambios.idCliente === undefined) next.delete('cn');
      return next;
    }, { replace: true });
  }, [setParams, filtros.desde, filtros.hasta]);

  /** Marca o desmarca una selección (un segundo clic sobre lo ya elegido la quita). */
  const alternar = useCallback(<K extends keyof FiltrosUI>(clave: K, valor: FiltrosUI[K]) => {
    cambiar({ [clave]: filtros[clave] === valor ? undefined : valor } as Partial<FiltrosUI>);
  }, [cambiar, filtros]);

  const limpiarSeleccion = useCallback(() => {
    cambiar(Object.fromEntries(CLAVES_SELECCION.map((k) => [k, undefined])) as Partial<FiltrosUI>);
  }, [cambiar]);

  const limpiar = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  /** Parámetros listos para la API. */
  const query = useMemo(() => ({
    desde: filtros.desde, hasta: filtros.hasta, idEmpleado: filtros.idEmpleado, idRuta: filtros.idRuta, idCliente: filtros.idCliente,
    idFormaPago: filtros.idFormaPago, diaSemana: filtros.diaSemana, diaMes: filtros.diaMes, tramo: filtros.tramo, baseRuta: filtros.baseRuta,
  }), [filtros]);

  const haySeleccion = CLAVES_SELECCION.some((k) => filtros[k] !== undefined);
  const hayFiltrosExtra = Boolean(filtros.idEmpleado || filtros.idRuta || filtros.idCliente || haySeleccion || filtros.preset !== presetInicial);
  return { filtros, query, cambiar, alternar, limpiar, limpiarSeleccion, haySeleccion, hayFiltrosExtra };
}
