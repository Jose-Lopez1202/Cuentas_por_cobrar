import type { RutasReporte } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { useApi } from './useApi';
import { useFiltros } from './useFiltros';
import { COLOR, Q, entero, fechaCorta, pct } from './format';
import { FilterBar } from './ui/FilterBar';
import { Encabezado, ErrorCaja, Esqueleto, Panel } from './ui/Panel';
import { KpiCard } from './ui/KpiCard';
import { RankBars } from './ui/charts';
import { DataGrid } from './ui/DataGrid';
import { EstadoPill, Medidor } from './ui/Pills';
import { useDetalle } from './detalle/DetalleHost';

export const RutasAnalisisPage = () => {
  const { filtros, query, cambiar, alternar, limpiar, hayFiltrosExtra } = useFiltros('90d');
  const { data, loading, error, reload } = useApi<RutasReporte>('/cxc/analitica/rutas', query);
  const { abrir, host } = useDetalle(query);

  const getSpec = (): ReportSpec | null => !data ? null : {
    filename: `rutas-recurrentes-${data.desde}_${data.hasta}`,
    title: 'Rutas recurrentes', subtitle: `Periodo ${data.desde} a ${data.hasta}`, orientation: 'landscape',
    summary: [['Rutas en el periodo', entero(data.totales.rutas)], ['Rutas que se repiten', entero(data.totales.recurrentes)], ['Paradas', entero(data.totales.paradas)], ['Efectividad de visitas', pct(data.totales.efectividad)]],
    sections: [
      { title: 'Rutas por zona', columns: [{ header: 'Ruta' }, { header: 'Salidas', type: 'int' }, { header: 'Cobradores', type: 'int' }, { header: 'Frecuencia (dias)', type: 'int' }, { header: 'Ultima salida' }, { header: 'Paradas', type: 'int' }, { header: 'Visitadas', type: 'int' }, { header: 'No encontrados', type: 'int' }, { header: 'Efectividad %', type: 'percent' }, { header: 'Pendiente', type: 'money' }], rows: data.rutas.map((r) => [r.base, r.veces, r.cobradores, r.frecuenciaDias ?? 0, r.ultimaFecha, r.paradas, r.visitadas, r.noEncontrados, r.efectividad, r.montoPendiente]) },
      { title: 'Clientes que reaparecen en ruta', columns: [{ header: 'Cliente' }, { header: 'Veces en ruta', type: 'int' }, { header: 'Visitado', type: 'int' }, { header: 'No encontrado', type: 'int' }, { header: 'Saldo vencido', type: 'money' }], rows: data.clientesRecurrentes.map((c) => [c.nombre, c.veces, c.visitadas, c.noEncontrado, c.saldoVencido]) },
    ],
  };

  return (
    <div>
      <FilterBar filtros={filtros} onChange={cambiar} onLimpiar={limpiar} mostrarLimpiar={hayFiltrosExtra} ruta cliente
        nota="Las rutas con el mismo nombre base (sin el número correlativo) se agrupan como una misma ruta" />
      <Encabezado
        titulo="Rutas recurrentes"
        descripcion="Qué zonas se salen una y otra vez, con qué frecuencia, y si las visitas realmente terminan en cobro."
        acciones={<ExportMenu getSpec={getSpec} disabledReason={!data || data.rutas.length === 0 ? 'No hay rutas en el período para exportar' : undefined} />}
      />
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <div className="space-y-4"><Esqueleto alto="h-[110px]" /><Esqueleto alto="h-80" /></div>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard etiqueta="Rutas en el período" valor={entero(data.totales.rutas)} color={COLOR.azul} nota={`${data.rutas.length} zona(s) distintas`} />
            <KpiCard etiqueta="Rutas que se repiten" valor={entero(data.totales.recurrentes)} color={COLOR.violeta} nota="Zonas con más de una salida" />
            <KpiCard etiqueta="Paradas planificadas" valor={entero(data.totales.paradas)} color={COLOR.naranja} nota={`${entero(data.totales.visitadas)} ya visitadas`} />
            <KpiCard etiqueta="Efectividad de visitas" valor={pct(data.totales.efectividad)} color={COLOR.aqua} nota="Paradas visitadas ÷ paradas planificadas" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" titulo="Rutas que más se repiten" subtitulo="Número de salidas por zona. Clic para filtrar todo el tablero; el ícono abre sus salidas y paradas" cargando={loading}>
              <RankBars
                items={data.zonas.slice(0, 10).map((r) => ({ clave: r.base, etiqueta: r.base, valor: r.veces, secundario: r.frecuenciaDias ? `c/${Math.round(r.frecuenciaDias)} d` : undefined }))}
                formato={(n) => `${n} ${n === 1 ? 'salida' : 'salidas'}`} color={COLOR.violeta}
                seleccionada={filtros.baseRuta} onSeleccionar={(i) => alternar('baseRuta', String(i.clave))}
                onDetalle={(i) => abrir({ tipo: 'ruta', base: String(i.clave) })} vacio="No hay rutas en este período." />
            </Panel>
            <Panel titulo="Estado de las rutas" subtitulo="Cómo terminaron las salidas">
              <ul className="divide-y divide-slate-100">
                {data.porEstado.map((e) => (
                  <li key={e.estado} className="flex items-center justify-between py-2.5">
                    <EstadoPill estado={e.estado} />
                    <strong className="text-[13px] tabular-nums text-slate-900">{entero(e.cantidad)}</strong>
                  </li>
                ))}
                {data.porEstado.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Sin rutas.</li>}
              </ul>
            </Panel>
          </div>

          <Panel titulo="Detalle por zona" subtitulo="Frecuencia, efectividad y dinero pendiente de cada ruta. Clic en una fila para abrir su detalle" cargando={loading}>
            <DataGrid
              filas={data.rutas} clave={(r) => r.base} porPagina={10} compacta ordenInicial={{ id: 'veces', dir: 'desc' }}
              buscar={(r) => r.base} placeholderBuscar="Buscar ruta…" vacio="No hay rutas en el período."
              onFila={(r) => abrir({ tipo: 'ruta', base: r.base })} etiquetaFila={(r) => `Ver detalle de ${r.base}`}
              columnas={[
                { id: 'base', encabezado: 'Ruta', valor: (r) => r.base, render: (r) => <span className="font-medium text-slate-900">{r.base}</span> },
                { id: 'veces', encabezado: 'Salidas', alinear: 'der', valor: (r) => r.veces, render: (r) => <strong>{r.veces}</strong> },
                { id: 'cob', encabezado: 'Cobradores', alinear: 'der', ayuda: 'Personas distintas que la han recorrido', valor: (r) => r.cobradores },
                { id: 'frec', encabezado: 'Cada', alinear: 'der', ayuda: 'Días promedio entre una salida y la siguiente', valor: (r) => r.frecuenciaDias, render: (r) => (r.frecuenciaDias ? `${Math.round(r.frecuenciaDias)} días` : <span className="text-slate-400">—</span>) },
                { id: 'ult', encabezado: 'Última salida', valor: (r) => r.ultimaFecha, render: (r) => fechaCorta(r.ultimaFecha) },
                {
                  id: 'efe', encabezado: 'Visitas', ancho: '150px', ayuda: 'Paradas visitadas / paradas planificadas', valor: (r) => r.efectividad,
                  render: (r) => <span className="flex items-center gap-2"><Medidor valor={r.efectividad} etiqueta="Efectividad de visitas" /><span className="w-16 text-right text-[12px] tabular-nums text-slate-600">{r.visitadas}/{r.paradas}</span></span>,
                },
                { id: 'ne', encabezado: 'No encontrados', alinear: 'der', valor: (r) => r.noEncontrados, render: (r) => (r.noEncontrados ? <span className="font-medium text-red-700">{r.noEncontrados}</span> : <span className="text-slate-400">0</span>) },
                { id: 'pend', encabezado: 'Por cobrar', alinear: 'der', valor: (r) => r.montoPendiente, render: (r) => Q(r.montoPendiente), total: (f) => Q(f.reduce((s, r) => s + r.montoPendiente, 0)) },
              ]} />
          </Panel>

          <Panel titulo="Clientes que reaparecen en ruta" subtitulo="Aparecen en 2 o más paradas del período. Si siguen debiendo, la visita no está funcionando: cambia de estrategia" cargando={loading}>
            <DataGrid
              filas={data.clientesRecurrentes} clave={(c) => c.idCliente} porPagina={8} compacta vacio="Ningún cliente se repite en las rutas del período."
              onFila={(c) => abrir({ tipo: 'cliente', id: c.idCliente })} etiquetaFila={(c) => `Ver ficha de ${c.nombre}`}
              columnas={[
                { id: 'n', encabezado: 'Cliente', valor: (c) => c.nombre, render: (c) => <span className="font-medium text-slate-900">{c.nombre}</span> },
                { id: 'v', encabezado: 'Veces en ruta', alinear: 'der', valor: (c) => c.veces },
                { id: 'vi', encabezado: 'Visitado', alinear: 'der', valor: (c) => c.visitadas },
                { id: 'ne', encabezado: 'No encontrado', alinear: 'der', valor: (c) => c.noEncontrado, render: (c) => (c.noEncontrado ? <span className="font-medium text-red-700">{c.noEncontrado}</span> : '0') },
                { id: 's', encabezado: 'Saldo vencido', alinear: 'der', valor: (c) => c.saldoVencido, render: (c) => <strong>{Q(c.saldoVencido)}</strong> },
              ]} />
          </Panel>
        </div>
      )}
      {host}
    </div>
  );
};
