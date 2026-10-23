import { Crown, TrendingDown } from 'lucide-react';
import type { CobradoresReporte } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { useApi } from './useApi';
import { useFiltros } from './useFiltros';
import { COLOR, Q, Qc, entero, pct } from './format';
import { FilterBar } from './ui/FilterBar';
import { Encabezado, ErrorCaja, Esqueleto, Panel, Vacio } from './ui/Panel';
import { KpiCard } from './ui/KpiCard';
import { RankBars } from './ui/charts';
import { DataGrid } from './ui/DataGrid';
import { Medidor } from './ui/Pills';
import { useDetalle } from './detalle/DetalleHost';

export const CobradoresPage = () => {
  const { filtros, query, cambiar, limpiar, hayFiltrosExtra } = useFiltros('90d');
  const { data, loading, error, reload } = useApi<CobradoresReporte>('/cxc/analitica/cobradores', { ...query, idEmpleado: undefined });
  const { abrir, host } = useDetalle(query);

  const conCobro = data?.cobradores.filter((c) => c.cobrado > 0) ?? [];
  const mejor = conCobro[0];
  const peor = conCobro.length > 1 ? conCobro[conCobro.length - 1] : undefined;
  const promedio = conCobro.length ? conCobro.reduce((s, c) => s + c.cobrado, 0) / conCobro.length : 0;

  const getSpec = (): ReportSpec | null => !data ? null : {
    filename: `ranking-cobradores-${data.desde}_${data.hasta}`,
    title: 'Ranking de cobradores', subtitle: `Periodo ${data.desde} a ${data.hasta}`, orientation: 'landscape',
    summary: [['Total cobrado', Q(data.totales.cobrado)], ['Pagos aplicados', entero(data.totales.pagos)], ['Gestiones', entero(data.totales.gestiones)], ['Cobradores activos', entero(data.totales.cobradoresActivos)]],
    sections: [{
      title: 'Desempeño por cobrador',
      columns: [{ header: '#', type: 'int' }, { header: 'Cobrador' }, { header: 'Cobrado', type: 'money' }, { header: 'Anterior', type: 'money' }, { header: 'Variacion %', type: 'percent' }, { header: 'Pagos', type: 'int' }, { header: 'Clientes', type: 'int' }, { header: 'Ticket', type: 'money' }, { header: 'Gestiones', type: 'int' }, { header: 'Efectividad %', type: 'percent' }, { header: 'Rutas', type: 'int' }, { header: 'Visitas %', type: 'percent' }],
      rows: data.cobradores.map((c) => [c.posicion, c.nombre, c.cobrado, c.cobradoAnterior, c.variacion ?? 0, c.pagos, c.clientesCobrados, c.ticketPromedio, c.gestiones, c.efectividadGestion, c.rutas, c.efectividadRuta]),
      totals: ['', 'TOTAL', data.totales.cobrado, '', '', data.totales.pagos, '', '', data.totales.gestiones, '', '', ''],
    }],
  };

  return (
    <div>
      <FilterBar filtros={filtros} onChange={cambiar} onLimpiar={limpiar} mostrarLimpiar={hayFiltrosExtra} cobrador={false}
        nota="Cobrado = pagos aplicados confirmados, atribuidos a quien los registró" />
      <Encabezado
        titulo="Ranking de cobradores"
        descripcion="Quién cobra más y quién cobra menos, con su gestión y su trabajo en ruta. Haz clic en un cobrador para ver el detalle."
        acciones={<ExportMenu getSpec={getSpec} disabledReason={!data || data.cobradores.length === 0 ? 'No hay datos para exportar' : undefined} />}
      />
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <div className="space-y-4"><Esqueleto alto="h-[110px]" /><Esqueleto alto="h-80" /></div>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard etiqueta="Total cobrado" valor={Q(data.totales.cobrado)} color={COLOR.azul} nota={`${entero(data.totales.pagos)} pagos aplicados`} />
            <KpiCard etiqueta="Cobradores activos" valor={entero(data.totales.cobradoresActivos)} color={COLOR.violeta} nota="Con cobro, gestión o ruta en el período" />
            <KpiCard etiqueta="Cobra más" valor={mejor ? mejor.nombre : '—'} color={COLOR.aqua}
              nota={mejor ? `${Q(mejor.cobrado)} · ${pct(mejor.participacion)} del total` : 'Sin cobros en el período'}
              onClick={mejor ? () => abrir({ tipo: 'cobrador', id: mejor.idEmpleado }) : undefined} />
            <KpiCard etiqueta="Cobra menos" valor={peor ? peor.nombre : '—'} color={COLOR.naranja}
              nota={peor ? `${Q(peor.cobrado)} · promedio del equipo ${Qc(promedio)}` : 'Se necesitan al menos 2 cobradores con cobro'}
              onClick={peor ? () => abrir({ tipo: 'cobrador', id: peor.idEmpleado }) : undefined} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel titulo="Quién cobra más" subtitulo="Dinero cobrado en el período. Clic para ver el detalle" cargando={loading}>
              <RankBars
                items={conCobro.slice(0, 8).map((c) => ({ clave: c.idEmpleado, etiqueta: c.nombre, valor: c.cobrado, secundario: pct(c.participacion, 0) }))}
                formato={Qc} onSeleccionar={(i) => abrir({ tipo: 'cobrador', id: Number(i.clave) })} vacio="Nadie registró cobros en este período." />
            </Panel>
            <Panel titulo="Quién gestiona mejor" subtitulo="% de gestiones de cobro en las que el cliente respondió" cargando={loading}>
              <RankBars
                items={[...data.cobradores].filter((c) => c.gestiones > 0).sort((x, y) => y.efectividadGestion - x.efectividadGestion).slice(0, 8)
                  .map((c) => ({ clave: c.idEmpleado, etiqueta: c.nombre, valor: c.efectividadGestion, secundario: `${c.gestiones} gest.` }))}
                formato={(n) => pct(n, 0)} color={COLOR.aqua} onSeleccionar={(i) => abrir({ tipo: 'cobrador', id: Number(i.clave) })} vacio="No hay gestiones en el período." />
            </Panel>
            <Panel titulo="Quién rinde más en ruta" subtitulo="% de paradas visitadas sobre las planificadas" cargando={loading}>
              <RankBars
                items={[...data.cobradores].filter((c) => c.paradas > 0).sort((x, y) => y.efectividadRuta - x.efectividadRuta).slice(0, 8)
                  .map((c) => ({ clave: c.idEmpleado, etiqueta: c.nombre, valor: c.efectividadRuta, secundario: `${c.paradasVisitadas}/${c.paradas}` }))}
                formato={(n) => pct(n, 0)} color={COLOR.violeta} onSeleccionar={(i) => abrir({ tipo: 'cobrador', id: Number(i.clave) })} vacio="No hay rutas con paradas en el período." />
            </Panel>
          </div>

          <Panel titulo="Detalle por cobrador" subtitulo="Cobro, gestión de cobranza y efectividad en ruta. Clic en una fila para ver su ficha" cargando={loading}>
            <DataGrid
              filas={data.cobradores} clave={(c) => c.idEmpleado} porPagina={10} compacta
              ordenInicial={{ id: 'cobrado', dir: 'desc' }}
              onFila={(c) => abrir({ tipo: 'cobrador', id: c.idEmpleado })} etiquetaFila={(c) => `Ver desempeño de ${c.nombre}`}
              buscar={(c) => c.nombre} placeholderBuscar="Buscar cobrador…" vacio="No hay actividad de cobradores en el período."
              columnas={[
                { id: 'pos', encabezado: '#', ancho: '40px', valor: (c) => c.posicion, render: (c) => c.posicion === 1 && c.cobrado > 0 ? <Crown size={15} className="text-amber-500" aria-label="Primer lugar" /> : <span className="text-slate-400">{c.posicion}</span> },
                { id: 'nombre', encabezado: 'Cobrador', valor: (c) => c.nombre, render: (c) => <span className="font-medium text-slate-900">{c.nombre}</span> },
                { id: 'cobrado', encabezado: 'Cobrado', alinear: 'der', valor: (c) => c.cobrado, render: (c) => <strong>{Q(c.cobrado)}</strong>, total: (f) => Q(f.reduce((s, c) => s + c.cobrado, 0)) },
                {
                  id: 'var', encabezado: 'Vs. anterior', alinear: 'der', ayuda: 'Cambio contra el período anterior de igual duración',
                  valor: (c) => c.variacion,
                  render: (c) => c.variacion == null
                    ? <span className="text-slate-400">—</span>
                    : <span className={`inline-flex items-center gap-0.5 font-medium ${c.variacion < 0 ? 'text-red-700' : 'text-emerald-800'}`}>{c.variacion < 0 && <TrendingDown size={13} aria-hidden="true" />}{c.variacion > 0 ? '+' : ''}{c.variacion.toLocaleString('es-GT', { maximumFractionDigits: 0 })} %</span>,
                },
                { id: 'pagos', encabezado: 'Pagos', alinear: 'der', valor: (c) => c.pagos, total: (f) => entero(f.reduce((s, c) => s + c.pagos, 0)) },
                { id: 'cli', encabezado: 'Clientes', alinear: 'der', valor: (c) => c.clientesCobrados },
                { id: 'ticket', encabezado: 'Ticket', alinear: 'der', ayuda: 'Monto promedio por pago aplicado', valor: (c) => c.ticketPromedio, render: (c) => (c.ticketPromedio ? Q(c.ticketPromedio) : '—') },
                { id: 'ges', encabezado: 'Gestiones', alinear: 'der', valor: (c) => c.gestiones, total: (f) => entero(f.reduce((s, c) => s + c.gestiones, 0)) },
                {
                  id: 'efe', encabezado: 'Respuesta', ancho: '120px', ayuda: 'Gestiones en las que el cliente respondió',
                  valor: (c) => c.efectividadGestion,
                  render: (c) => c.gestiones ? <span className="flex items-center gap-2"><Medidor valor={c.efectividadGestion} etiqueta="Efectividad de gestión" /><span className="w-9 text-right text-[12px] tabular-nums text-slate-600">{pct(c.efectividadGestion, 0)}</span></span> : <span className="text-slate-400">—</span>,
                },
                { id: 'rut', encabezado: 'Visitas', alinear: 'der', ayuda: 'Paradas visitadas / paradas planificadas', valor: (c) => c.efectividadRuta, render: (c) => c.paradas ? `${c.paradasVisitadas}/${c.paradas}` : <span className="text-slate-400">—</span> },
              ]} />
          </Panel>

          {data.cobradores.length === 0 && <Vacio texto="Sin actividad en el período" detalle="Amplía el rango de fechas para ver el ranking." />}
        </div>
      )}
      {host}
    </div>
  );
};
