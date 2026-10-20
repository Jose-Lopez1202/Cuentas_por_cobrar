import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRESETS, rangoDePreset, type PresetPeriodo } from './format';

export interface FiltrosUI {
  preset: PresetPeriodo;
  desde: string;
  hasta: string;
  idEmpleado?: number;
  idRuta?: number;
}

const PRESETS_VALIDOS = new Set<string>([...PRESETS.map((p) => p.id), 'custom', 'hoy']);
const num = (v: string | null) => { const n = Number(v); return v && Number.isInteger(n) && n > 0 ? n : undefined; };
const esIso = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

/**
 * Los filtros viven en la URL (?p=90d&e=3&r=12): se pueden compartir o guardar el enlace,
 * y al volver atrás el tablero queda igual.
 */
export function useFiltros(presetInicial: PresetPeriodo = '90d') {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo<FiltrosUI>(() => {
    const p = params.get('p');
    const preset = (p && PRESETS_VALIDOS.has(p) ? p : presetInicial) as PresetPeriodo;
    const base = rangoDePreset(preset === 'custom' ? presetInicial : preset);
    const desde = preset === 'custom' && esIso(params.get('d')) ? params.get('d')! : base.desde;
    const hasta = preset === 'custom' && esIso(params.get('h')) ? params.get('h')! : base.hasta;
    return { preset, desde, hasta, idEmpleado: num(params.get('e')), idRuta: num(params.get('r')) };
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
      if ('idEmpleado' in cambios) set('e', cambios.idEmpleado);
      if ('idRuta' in cambios) set('r', cambios.idRuta);
      return next;
    }, { replace: true });
  }, [setParams, filtros.desde, filtros.hasta]);

  const limpiar = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  /** Parámetros listos para la API. */
  const query = useMemo(() => ({ desde: filtros.desde, hasta: filtros.hasta, idEmpleado: filtros.idEmpleado, idRuta: filtros.idRuta }), [filtros]);

  const hayFiltrosExtra = Boolean(filtros.idEmpleado || filtros.idRuta || filtros.preset !== presetInicial);
  return { filtros, query, cambiar, limpiar, hayFiltrosExtra };
}
