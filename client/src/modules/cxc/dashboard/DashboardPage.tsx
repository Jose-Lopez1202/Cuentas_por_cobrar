import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import type { ResumenEjecutivo } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { useApi } from '../analisis/useApi';
import { useFiltros } from '../analisis/useFiltros';
import { COLOR, Q, Qc, RAMPA_AZUL, agruparSerie, entero, fechaCorta, pct } from '../analisis/format';
import { FilterBar } from '../analisis/ui/FilterBar';
import { Encabezado, ErrorCaja, Esqueleto, Panel, Vacio } from '../analisis/ui/Panel';
import { KpiCard } from '../analisis/ui/KpiCard';
import { ColumnasChart, RankBars, TendenciaChart } from '../analisis/ui/charts';
import { DataGrid } from '../analisis/ui/DataGrid';
import { AlertaItem, EstadoPill } from '../analisis/ui/Pills';
import { useDetalle } from '../analisis/detalle/DetalleHost';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { filtros, query, cambiar, limpiar, hayFiltrosExtra } = useFiltros('90d');
  const { data, loading, error, reload } = useApi<ResumenEjecutivo>('/cxc/analitica/resumen', query);
  const { abrir, host } = useDetalle(query);
  const rangoValido = filtros.desde <= filtros.hasta;

  const serie = useMemo(() => (data ? agruparSerie(data.serie.map((p) => ({ ...p })), ['cobrado', 'facturado']) : []), [data]);

  const getSpec = (): ReportSpec | null => {
    if (!data) return null;
    const k = data.kpis;
    return {
      filename: `panel-cobranza-${data.desde}_${data.hasta}`,
      title: 'Panel de Cuentas por Cobrar',
      subtitle: `Periodo ${data.desde} a ${data.hasta}`,
      orientation: 'landscape',
      summary: [
        ['Cobrado', Q(k.cobrado.actual)], ['Facturado', Q(k.facturado.actual)],
        ['Indice de cobranza', k.indiceCobranza ? pct(k.indiceCobranza.actual) : 'N/D'],
        ['Cartera total', Q(data.cartera.total)], ['Cartera vencida', `${Q(data.cartera.vencida)} (${pct(data.cartera.porcentajeVencida)})`],
        ['Dias de cartera', `${data.cartera.diasCartera} dias`],
      ],
      sections: [
        { title: 'Antiguedad de saldos', columns: [{ header: 'Tramo' }, { header: 'Documentos', type: 'int' }, { header: 'Monto', type: 'money' }], rows: data.antiguedad.map((t) => [t.tramo, t.documentos, t.monto]) },
        { title: 'Mayores deudores vencidos', columns: [{ header: 'Cliente' }, { header: 'NIT' }, { header: 'Dias de atraso', type: 'int' }, { header: 'Saldo vencido', type: 'money' }, { header: 'Saldo total', type: 'money' }], rows: data.topDeudores.map((d) => [d.nombre, d.nit ?? '', d.diasMaxMora, d.saldoVencido, d.saldoTotal]) },
        { title: 'Cobro por forma de pago', columns: [{ header: 'Forma de pago' }, { header: 'Pagos', type: 'int' }, { header: 'Monto', type: 'money' }], rows: data.formasPago.map((f) => [f.formaPago, f.pagos, f.monto]) },
        { title: 'Vencimientos proximos', columns: [{ header: 'Semana' }, { header: 'Desde' }, { header: 'Documentos', type: 'int' }, { header: 'Monto', type: 'money' }], rows: data.vencimientosProximos.map((v) => [v.semana, v.desde, v.documentos, v.monto]) },
      ],
    };
  };

  const k = data?.kpis;
  const tendCobrado = data?.serie.map((p) => p.cobrado);
  const tendFacturado = data?.serie.map((p) => p.facturado);

  return (
    <div>
      <FilterBar filtros={filtros} onChange={cambiar} onLimpiar={limpiar} mostrarLimpiar={hayFiltrosExtra}
        nota="La cartera y la antigüedad muestran el saldo de hoy; el cobrador solo filtra el cobro y la gestión" />

      <Encabezado
        titulo="Panel de Cuentas por Cobrar"
        descripcion="Cómo va la cobranza, qué tan sana está la cartera y dónde hay que actuar hoy."
        acciones={<>
          <button type="button" onClick={reload} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Actualizar
          </button>
          <ExportMenu getSpec={getSpec} disabledReason={!data ? 'Espera a que carguen los datos para exportar' : undefined} />
        </>}
      />

      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {!rangoValido && <ErrorCaja mensaje="El rango de fechas no es válido: la fecha inicial es posterior a la final." />}

      {loading && !data && rangoValido && (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Esqueleto key={i} alto="h-[118px]" />)}</div>
          <Esqueleto alto="h-72" />
        </div>
      )}

      {data && k && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard etiqueta="Cobrado" valor={Q(k.cobrado.actual)} comparar={k.cobrado} tendencia={tendCobrado} color={COLOR.azul} />
            <KpiCard etiqueta="Facturado" valor={Q(k.facturado.actual)} comparar={k.facturado} tendencia={tendFacturado} color={COLOR.naranja} />
            <KpiCard
              etiqueta="Índice de cobranza"
              valor={k.indiceCobranza ? pct(k.indiceCobranza.actual) : '—'}
              comparar={k.indiceCobranza ?? undefined}
              nota={k.indiceCobranza ? undefined : 'No aplica por cobrador: la facturación no se asigna a una persona'}
              color={COLOR.aqua}
            />
            <KpiCard
              etiqueta="Cartera vencida" valor={Q(data.cartera.vencida)} color={COLOR.critico}
              nota={`${pct(data.cartera.porcentajeVencida)} de ${Qc(data.cartera.total)} · ${entero(data.cartera.clientesVencidos)} clientes`}
              onClick={() => navigate('/cxc/analisis/clientes-riesgo')}
            />
            <KpiCard
              etiqueta="Días de cartera" valor={`${entero(data.cartera.diasCartera)} días`} color={COLOR.violeta}
              nota="Cartera ÷ venta diaria. Menos es mejor"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" titulo="Cobrado vs. facturado" cargando={loading}
              subtitulo={`Pagos aplicados y documentos emitidos, ${serie.length > 62 ? 'agrupados' : 'por día'}`}>
              {data.serie.every((p) => p.cobrado === 0 && p.facturado === 0)
                ? <Vacio texto="No hay movimientos en este período" detalle="Prueba con un rango más amplio o quita el filtro de cobrador o ruta." />
                : <TendenciaChart datos={serie} series={[
                  { clave: 'facturado', etiqueta: 'Facturado', color: COLOR.naranja },
                  { clave: 'cobrado', etiqueta: 'Cobrado', color: COLOR.azul, area: true },
                ]} />}
            </Panel>

            <Panel titulo="Qué atender" subtitulo="Alertas calculadas con los datos de hoy" cuerpoClassName="space-y-2">
              {data.alertas.length === 0
                ? <Vacio texto="Sin alertas" detalle="No hay promesas vencidas ni cartera crítica. Buen momento para revisar el ranking de cobradores." />
                : data.alertas.map((a) => <AlertaItem key={a.id} severidad={a.severidad} titulo={a.titulo} detalle={a.detalle} onClick={a.destino ? () => navigate(a.destino!) : undefined} />)}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel titulo="Antigüedad de la cartera" subtitulo="Saldo pendiente según los días que lleva vencido">
              <ColumnasChart etiquetaValor="Saldo" alto={230}
                datos={data.antiguedad.map((t, i) => ({ clave: t.tramo, etiqueta: ['Corriente', '1-30', '31-60', '61-90', '+90'][i] ?? t.tramo, valor: t.monto, extra: `${t.documentos} documento(s)`, color: RAMPA_AZUL[i] }))}
                onSeleccionar={() => navigate('/cxc/reportes/antiguedad-saldos')} />
              <p className="mt-2 text-[11.5px] text-slate-500">Haz clic en una columna para abrir el reporte completo.</p>
            </Panel>

            <Panel titulo="Vencimientos próximos" subtitulo="Lo que vence en las siguientes 4 semanas">
              {data.vencimientosProximos.length === 0
                ? <Vacio texto="Nada vence en las próximas 4 semanas" />
                : <ColumnasChart etiquetaValor="Por vencer" alto={230} color={COLOR.aqua}
                  datos={data.vencimientosProximos.map((v) => ({ clave: v.desde, etiqueta: v.semana.replace('Próxima semana', 'Próxima').replace('Esta semana', 'Esta'), valor: v.monto, extra: `${v.documentos} documento(s) desde ${fechaCorta(v.desde, false)}` }))} />}
            </Panel>

            <Panel titulo="Cobro por forma de pago" subtitulo="Pagos aplicados en el período">
              <RankBars items={data.formasPago.map((f) => ({ clave: f.formaPago, etiqueta: f.formaPago, valor: f.monto, secundario: `${f.pagos} pagos` }))} vacio="Sin pagos aplicados en el período." />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" titulo="Mayores deudores vencidos" subtitulo="Haz clic en un cliente para ver su ficha completa: documentos, pagos, promesas y gestiones">
              <DataGrid
                filas={data.topDeudores} clave={(d) => d.idCliente} porPagina={6} compacta vacio="No hay clientes con saldo vencido."
                onFila={(d) => abrir({ tipo: 'cliente', id: d.idCliente })} etiquetaFila={(d) => `Ver ficha de ${d.nombre}`}
                columnas={[
                  { id: 'n', encabezado: 'Cliente', valor: (d) => d.nombre, render: (d) => <span><span className="font-medium text-slate-900">{d.nombre}</span><span className="block text-[11.5px] text-slate-500">NIT {d.nit ?? '—'}</span></span> },
                  { id: 'd', encabezado: 'Atraso', alinear: 'der', valor: (d) => d.diasMaxMora, render: (d) => `${d.diasMaxMora} d` },
                  { id: 'v', encabezado: 'Vencido', alinear: 'der', valor: (d) => d.saldoVencido, render: (d) => <strong>{Q(d.saldoVencido)}</strong> },
                  { id: 't', encabezado: 'Saldo total', alinear: 'der', valor: (d) => d.saldoTotal, render: (d) => Q(d.saldoTotal) },
                ]} />
            </Panel>

            <div className="space-y-4">
              <Panel titulo="Cobradores que más cobran" subtitulo="Clic para ver su desempeño"
                acciones={<button type="button" onClick={() => navigate('/cxc/analisis/cobradores')} className="text-[12px] font-medium text-blue-800 hover:underline">Ver ranking</button>}>
                <RankBars items={data.topCobradores.map((c) => ({ clave: c.idEmpleado, etiqueta: c.nombre, valor: c.cobrado }))}
                  formato={Qc} onSeleccionar={(i) => abrir({ tipo: 'cobrador', id: Number(i.clave) })} vacio="Aún no hay cobros registrados por cobrador." />
              </Panel>
              <Panel titulo="Promesas de pago" subtitulo="Compromisos registrados en el período">
                {data.promesas.length === 0 ? <Vacio texto="Sin promesas en el período" /> : (
                  <ul className="divide-y divide-slate-100">
                    {data.promesas.map((p) => (
                      <li key={p.estado} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                        <EstadoPill estado={p.estado} />
                        <span className="text-slate-500">{entero(p.cantidad)} promesa(s)</span>
                        <strong className="tabular-nums text-slate-900">{Q(p.monto)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
      {host}
    </div>
  );
};
