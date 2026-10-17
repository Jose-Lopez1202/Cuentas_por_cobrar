import type { EstadisticaCobranza } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { useApi } from '../analisis/useApi';
import { useFiltros } from '../analisis/useFiltros';
import { COLOR, Q, Qc, entero, pct } from '../analisis/format';
import { FilterBar } from '../analisis/ui/FilterBar';
import { Encabezado, ErrorCaja, Esqueleto, Panel } from '../analisis/ui/Panel';
import { KpiCard } from '../analisis/ui/KpiCard';
import { RankBars, TendenciaChart } from '../analisis/ui/charts';
import { DataGrid } from '../analisis/ui/DataGrid';
import { EstadoPill, etiquetaEstado } from '../analisis/ui/Pills';
import { useDetalle } from '../analisis/detalle/DetalleHost';

export const EstadisticaCobranzaPage = () => {
  const { filtros, query, cambiar, limpiar, hayFiltrosExtra } = useFiltros('90d');
  const { data, loading, error, reload } = useApi<EstadisticaCobranza>('/cxc/reportes/estadistica-cobranza', { desde: query.desde, hasta: query.hasta });
  const { abrir, host } = useDetalle(query);

  const getSpec = (): ReportSpec | null => {
    if (!data) return null;
    const t = data.totales;
    return {
      filename: `estadistica-cobranza-${data.desde}_${data.hasta}`, title: 'Estadistica de Cobranza', subtitle: `Periodo ${data.desde} a ${data.hasta}`,
      summary: [['Indice de cobranza', pct(t.indiceCobranza)], ['Facturado', Q(t.facturado)], ['Cobrado', Q(t.cobrado)], ['Cartera total', Q(t.carteraTotal)], ['Cartera vencida', `${Q(t.carteraVencida)} (${pct(t.porcentajeVencida)})`], ['Dias de cartera', `${t.diasCartera} dias`]],
      sections: [
        { title: 'Facturado vs cobrado por mes', columns: [{ header: 'Periodo' }, { header: 'Facturado', type: 'money' }, { header: 'Cobrado', type: 'money' }, { header: 'Indice', type: 'percent' }], rows: data.porMes.map((m) => [m.periodo, m.facturado, m.cobrado, m.facturado > 0 ? Math.round((m.cobrado / m.facturado) * 1000) / 10 : 0]), totals: ['TOTAL', t.facturado, t.cobrado, t.indiceCobranza] },
        { title: 'Pagos por forma de pago', columns: [{ header: 'Forma de pago' }, { header: 'Pagos', type: 'int' }, { header: 'Monto', type: 'money' }], rows: data.porFormaPago.map((f) => [f.formaPago, f.pagos, f.monto]) },
        { title: 'Promesas de pago', columns: [{ header: 'Estado' }, { header: 'Cantidad', type: 'int' }, { header: 'Monto', type: 'money' }], rows: data.promesas.map((p) => [p.estado, p.cantidad, p.monto]) },
        { title: 'Gestiones de cobro', columns: [{ header: 'Resultado' }, { header: 'Cantidad', type: 'int' }], rows: data.gestiones.map((g) => [g.resultado, g.cantidad]) },
        { title: 'Convenios de pago', columns: [{ header: 'Estado' }, { header: 'Cantidad', type: 'int' }, { header: 'Deuda convenida', type: 'money' }], rows: data.convenios.map((c) => [c.estado, c.cantidad, c.monto]) },
      ],
    };
  };

  const t = data?.totales;
  const serie = data?.porMes.map((m) => ({ etiqueta: m.periodo, fecha: m.periodo, facturado: m.facturado, cobrado: m.cobrado })) ?? [];

  return (
    <div>
      <FilterBar filtros={filtros} onChange={cambiar} onLimpiar={limpiar} mostrarLimpiar={hayFiltrosExtra} cobrador={false} ruta={false}
        nota="La cartera es la de hoy; el resto corresponde al período" />
      <Encabezado
        titulo="Estadística de cobranza"
        descripcion="Qué tanto de lo facturado se cobra, cómo está la cartera y qué resultado dan las gestiones. Clic en un mes para ver los pagos que lo componen."
        acciones={<ExportMenu getSpec={getSpec} disabledReason={!data || data.porMes.length === 0 ? 'No hay datos en el período para exportar' : undefined} />}
      />
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <div className="space-y-4"><Esqueleto alto="h-[110px]" /><Esqueleto alto="h-80" /></div>}

      {data && t && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard etiqueta="Índice de cobranza" valor={pct(t.indiceCobranza)} color={COLOR.aqua} nota={`${Qc(t.cobrado)} cobrados de ${Qc(t.facturado)} facturados`} />
            <KpiCard etiqueta="Cobrado en el período" valor={Q(t.cobrado)} color={COLOR.azul} nota="Pagos aplicados confirmados" />
            <KpiCard etiqueta="Cartera vencida" valor={pct(t.porcentajeVencida)} color={COLOR.critico} nota={`${Q(t.carteraVencida)} de ${Q(t.carteraTotal)}`} />
            <KpiCard etiqueta="Días de cartera" valor={`${entero(t.diasCartera)} días`} color={COLOR.violeta} nota="Cartera ÷ venta diaria del período" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" titulo="Facturado vs. cobrado por mes" subtitulo="Cuando la línea azul se acerca a la naranja, se está cobrando lo que se factura" cargando={loading}>
              <TendenciaChart datos={serie} series={[{ clave: 'facturado', etiqueta: 'Facturado', color: COLOR.naranja }, { clave: 'cobrado', etiqueta: 'Cobrado', color: COLOR.azul, area: true }]} alto={260} />
            </Panel>
            <Panel titulo="Pagos por forma de pago" subtitulo="Dinero recibido en el período">
              <RankBars items={data.porFormaPago.map((f) => ({ clave: f.formaPago, etiqueta: f.formaPago, valor: f.monto, secundario: `${f.pagos} pagos` }))} vacio="Sin pagos en el período." />
            </Panel>
          </div>

          <Panel titulo="Mes por mes" subtitulo="Clic en una fila para ver los pagos aplicados de ese mes" cargando={loading}>
            <DataGrid
              filas={data.porMes} clave={(m) => m.periodo} porPagina={12} compacta vacio="Sin movimientos en el período."
              onFila={(m) => abrir({ tipo: 'pagos', titulo: `Pagos aplicados en ${m.periodo}`, modo: 'periodo', valor: m.periodo })} etiquetaFila={(m) => `Ver pagos de ${m.periodo}`}
              columnas={[
                { id: 'p', encabezado: 'Período', valor: (m) => m.periodo, total: () => 'Total' },
                { id: 'f', encabezado: 'Facturado', alinear: 'der', valor: (m) => m.facturado, render: (m) => Q(m.facturado), total: () => Q(t.facturado) },
                { id: 'c', encabezado: 'Cobrado', alinear: 'der', valor: (m) => m.cobrado, render: (m) => <strong>{Q(m.cobrado)}</strong>, total: () => Q(t.cobrado) },
                { id: 'i', encabezado: 'Índice', alinear: 'der', valor: (m) => (m.facturado > 0 ? m.cobrado / m.facturado : 0), render: (m) => (m.facturado > 0 ? pct((m.cobrado / m.facturado) * 100) : '—'), total: () => pct(t.indiceCobranza) },
              ]} />
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel titulo="Promesas de pago" subtitulo="Compromisos registrados en el período">
              <DataGrid filas={data.promesas} clave={(p) => p.estado} compacta vacio="Sin promesas en el período." columnas={[
                { id: 'e', encabezado: 'Estado', valor: (p) => p.estado, render: (p) => <EstadoPill estado={p.estado} /> },
                { id: 'n', encabezado: 'Cantidad', alinear: 'der', valor: (p) => p.cantidad },
                { id: 'm', encabezado: 'Monto', alinear: 'der', valor: (p) => p.monto, render: (p) => Q(p.monto) },
              ]} />
            </Panel>
            <Panel titulo="Resultado de las gestiones" subtitulo="Qué pasó cuando se contactó al cliente">
              <RankBars items={data.gestiones.map((g) => ({ clave: g.resultado, etiqueta: etiquetaEstado(g.resultado), valor: g.cantidad }))} formato={entero} color={COLOR.aqua} vacio="Sin gestiones en el período." />
            </Panel>
            <Panel titulo="Convenios de pago" subtitulo="Acuerdos firmados en el período">
              <DataGrid filas={data.convenios} clave={(c) => c.estado} compacta vacio="Sin convenios en el período." columnas={[
                { id: 'e', encabezado: 'Estado', valor: (c) => c.estado, render: (c) => <EstadoPill estado={c.estado} /> },
                { id: 'n', encabezado: 'Cantidad', alinear: 'der', valor: (c) => c.cantidad },
                { id: 'm', encabezado: 'Deuda', alinear: 'der', valor: (c) => c.monto, render: (c) => Q(c.monto) },
              ]} />
            </Panel>
          </div>
        </div>
      )}
      {host}
    </div>
  );
};
