import { useMemo, useState } from 'react';
import type { ClientesRiesgoReporte, NivelRiesgo } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { useApi } from './useApi';
import { useFiltros } from './useFiltros';
import { COLOR, Q, RIESGO, entero, pct } from './format';
import { FilterBar } from './ui/FilterBar';
import { Encabezado, ErrorCaja, Esqueleto, Panel } from './ui/Panel';
import { KpiCard } from './ui/KpiCard';
import { MatrizRiesgo } from './ui/charts';
import { DataGrid } from './ui/DataGrid';
import { RiesgoPill } from './ui/Pills';
import { useDetalle } from './detalle/DetalleHost';

const NIVELES: NivelRiesgo[] = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO'];

export const ClientesRiesgoPage = () => {
  const { filtros, query, cambiar, limpiar, hayFiltrosExtra } = useFiltros('90d');
  const { data, loading, error, reload } = useApi<ClientesRiesgoReporte>('/cxc/analitica/clientes-riesgo', { ...query, idEmpleado: undefined, idCliente: undefined });
  const { abrir, host } = useDetalle(query);
  const [nivel, setNivel] = useState<NivelRiesgo | 'TODOS'>('TODOS');

  // Filtrado cruzado en el cliente: elegir un punto, un nivel o un cliente recalcula todo el tablero.
  const selCliente = filtros.idCliente;
  const base = data?.clientes ?? [];
  const porCliente = useMemo(() => base.filter((c) => !selCliente || c.idCliente === selCliente), [base, selCliente]);
  const filas = useMemo(() => porCliente.filter((c) => nivel === 'TODOS' || c.nivel === nivel), [porCliente, nivel]);
  const conteo = (n: NivelRiesgo) => porCliente.filter((c) => c.nivel === n).length;
  const t = data ? {
    clientes: porCliente.length,
    criticos: conteo('CRITICO'), altos: conteo('ALTO'), medios: conteo('MEDIO'), bajos: conteo('BAJO'),
    saldoVencido: porCliente.reduce((s, c) => s + c.saldoVencido, 0),
    saldoEnRiesgo: porCliente.filter((c) => c.nivel === 'CRITICO' || c.nivel === 'ALTO').reduce((s, c) => s + c.saldoVencido, 0),
  } : undefined;
  const elegirPunto = (c: { idCliente: number; nombre: string }) =>
    cambiar(selCliente === c.idCliente ? { idCliente: undefined } : { idCliente: c.idCliente, nombreCliente: c.nombre });

  const getSpec = (): ReportSpec | null => !data ? null : {
    filename: `clientes-en-riesgo-${new Date().toISOString().slice(0, 10)}`,
    title: 'Clientes problemáticos (riesgo de cobro)', subtitle: 'Puntaje de riesgo 0-100 sobre el saldo pendiente actual', orientation: 'landscape',
    summary: [['Clientes con saldo', entero(data.totales.clientes)], ['Criticos', entero(data.totales.criticos)], ['Altos', entero(data.totales.altos)], ['Saldo vencido', Q(data.totales.saldoVencido)], ['Saldo en riesgo (critico y alto)', Q(data.totales.saldoEnRiesgo)]],
    sections: [{
      title: 'Clientes ordenados por riesgo',
      columns: [{ header: 'Cliente' }, { header: 'NIT' }, { header: 'Nivel' }, { header: 'Puntaje', type: 'int' }, { header: 'Saldo vencido', type: 'money' }, { header: 'Saldo total', type: 'money' }, { header: 'Dias de atraso', type: 'int' }, { header: 'Promesas incumplidas', type: 'int' }, { header: 'Gestiones sin respuesta', type: 'int' }, { header: 'Visitas fallidas', type: 'int' }],
      rows: data.clientes.map((c) => [c.nombre, c.nit ?? '', RIESGO[c.nivel].etiqueta, c.score, c.saldoVencido, c.saldoTotal, c.diasMaxMora, c.promesasIncumplidas, c.gestionesSinRespuesta, c.visitasFallidas]),
    }],
  };

  return (
    <div>
      <FilterBar filtros={filtros} onChange={cambiar} onLimpiar={limpiar} mostrarLimpiar={hayFiltrosExtra} cobrador={false} cliente
        nota="El riesgo se calcula con el saldo y el historial de hoy; el período no lo cambia" />
      <Encabezado
        titulo="Clientes problemáticos"
        descripcion="Puntaje de riesgo de 0 a 100 por cliente. Combina antigüedad, monto, promesas rotas, historial de pago y contacto fallido. Clic en un cliente para ver por qué."
        acciones={<ExportMenu getSpec={getSpec} disabledReason={!data || data.clientes.length === 0 ? 'No hay clientes con saldo para exportar' : undefined} />}
      />
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <div className="space-y-4"><Esqueleto alto="h-[110px]" /><Esqueleto alto="h-80" /></div>}

      {data && t && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard etiqueta="Clientes con saldo" valor={entero(t.clientes)} color={COLOR.azul} nota={`${Q(t.saldoVencido)} vencidos en total`} />
            <KpiCard etiqueta="Críticos y altos" valor={entero(t.criticos + t.altos)} color={RIESGO.CRITICO.color} nota={`${t.criticos} críticos · ${t.altos} altos`} onClick={() => setNivel(t.criticos ? 'CRITICO' : 'ALTO')} />
            <KpiCard etiqueta="Saldo en riesgo" valor={Q(t.saldoEnRiesgo)} color={COLOR.naranja} nota="Vencido de clientes críticos y altos" />
            <KpiCard etiqueta="Riesgo medio" valor={entero(t.medios)} color={RIESGO.MEDIO.color} nota="Conviene darles seguimiento antes de que empeoren" onClick={() => setNivel('MEDIO')} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" titulo="Matriz de riesgo" subtitulo="Arriba a la derecha están los clientes más atrasados y con más dinero vencido. Clic en un punto para filtrar todo el tablero por ese cliente" cargando={loading}>
              <MatrizRiesgo clientes={data.clientes} idSeleccionado={selCliente} nivelSeleccionado={nivel === 'TODOS' ? undefined : nivel} onSeleccionar={elegirPunto} />
            </Panel>
            <Panel titulo="Distribución por nivel" subtitulo="Clic en un nivel para filtrar el tablero">
              <ul className="space-y-1.5">
                {NIVELES.map((n) => {
                  const cant = conteo(n);
                  return (
                    <li key={n}>
                      <button type="button" onClick={() => setNivel(nivel === n ? 'TODOS' : n)} aria-pressed={nivel === n}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${nivel === n ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <RiesgoPill nivel={n} />
                        <span className="flex-1 text-[12px] text-slate-500">{n === 'CRITICO' ? '70 o más' : n === 'ALTO' ? '50 a 69' : n === 'MEDIO' ? '30 a 49' : 'menos de 30'}</span>
                        <strong className="text-sm tabular-nums text-slate-900">{cant}</strong>
                        <span className="w-12 text-right text-[11.5px] tabular-nums text-slate-500">{pct(t.clientes ? (cant / t.clientes) * 100 : 0, 0)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          <Panel
            titulo="Clientes ordenados por riesgo" cargando={loading}
            subtitulo={nivel === 'TODOS' ? 'Todos los clientes con saldo pendiente' : `Solo nivel ${RIESGO[nivel].etiqueta.toLowerCase()} · `}
            acciones={nivel !== 'TODOS' ? <button type="button" onClick={() => setNivel('TODOS')} className="text-[12px] font-medium text-blue-800 hover:underline">Quitar filtro</button> : undefined}
          >
            <DataGrid
              filas={filas} clave={(c) => c.idCliente} porPagina={12} compacta ordenInicial={{ id: 'score', dir: 'desc' }}
              buscar={(c) => `${c.nombre} ${c.nit ?? ''}`} placeholderBuscar="Buscar por nombre o NIT…" vacio="No hay clientes en este nivel."
              onFila={(c) => abrir({ tipo: 'cliente', id: c.idCliente })} etiquetaFila={(c) => `Ver ficha de ${c.nombre}`}
              columnas={[
                { id: 'n', encabezado: 'Cliente', valor: (c) => c.nombre, render: (c) => <span><span className="font-medium text-slate-900">{c.nombre}</span><span className="block text-[11.5px] text-slate-500">NIT {c.nit ?? '—'}</span></span> },
                { id: 'score', encabezado: 'Riesgo', valor: (c) => c.score, render: (c) => <RiesgoPill nivel={c.nivel} score={c.score} /> },
                { id: 'v', encabezado: 'Vencido', alinear: 'der', valor: (c) => c.saldoVencido, render: (c) => <strong>{Q(c.saldoVencido)}</strong>, total: (f) => Q(f.reduce((s, c) => s + c.saldoVencido, 0)) },
                { id: 'd', encabezado: 'Atraso', alinear: 'der', ayuda: 'Días del documento más atrasado', valor: (c) => c.diasMaxMora, render: (c) => `${c.diasMaxMora} d` },
                { id: 'p', encabezado: 'Pago prom.', alinear: 'der', ayuda: 'Días de atraso con los que suele pagar', valor: (c) => c.diasPromedioPago, render: (c) => c.diasPromedioPago == null ? <span className="text-slate-400">Nunca pagó</span> : c.diasPromedioPago <= 0 ? 'A tiempo' : `${c.diasPromedioPago} d`},
                { id: 'pr', encabezado: 'Promesas rotas', alinear: 'der', valor: (c) => c.promesasIncumplidas, render: (c) => (c.promesasIncumplidas ? <span className="font-medium text-red-700">{c.promesasIncumplidas}</span> : '0') },
                { id: 'sr', encabezado: 'Sin respuesta', alinear: 'der', ayuda: 'Gestiones sin respuesta + visitas fallidas', valor: (c) => c.gestionesSinRespuesta + c.visitasFallidas },
              ]} />
          </Panel>
        </div>
      )}
      {host}
    </div>
  );
};
