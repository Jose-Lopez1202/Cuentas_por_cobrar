import { useEffect, useState } from 'react';
import { CalendarClock, Gauge, TriangleAlert, Wallet } from 'lucide-react';
import { DataTable, StatusBadge } from '../../../shared/ui-kit';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { DonutChart, HorizontalBarList, KpiTile, TrendLineChart } from '../../../shared/charts';
import { apiClient, ApiError } from '../../../shared/api';
import { moneyGT } from '../../../shared/csv';
import type { EstadisticaCobranza } from '@erp/contracts';
import { RangoFechas, rangoInicial, validarRango } from './components/RangoFechas';

const COLOR_PROMESA: Record<string, string> = { CUMPLIDA: '#1baf7a', PENDIENTE: '#eb6834', INCUMPLIDA: '#c0392b' };
const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7', '#008300', '#c2410c'];
const card = 'bg-white rounded-xl border border-slate-200 shadow-sm p-5';
const pct = (n: number) => `${n.toLocaleString('es-GT', { maximumFractionDigits: 1 })} %`;

export const EstadisticaCobranzaPage = () => {
  const [rango, setRango] = useState(rangoInicial());
  const [data, setData] = useState<EstadisticaCobranza | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const errores = validarRango(rango.desde, rango.hasta);
  const valido = !errores.desde && !errores.hasta;

  useEffect(() => {
    if (!valido) return;
    setIsLoading(true); setError(null);
    apiClient.get<EstadisticaCobranza>(`/cxc/reportes/estadistica-cobranza?desde=${rango.desde}&hasta=${rango.hasta}`)
      .then(setData)
      .catch((err) => { setData(null); setError(err instanceof ApiError ? err.message : 'No se pudo cargar la estadística'); })
      .finally(() => setIsLoading(false));
  }, [rango.desde, rango.hasta, valido]);

  const getSpec = (): ReportSpec | null => {
    if (!data) return null;
    const t = data.totales;
    return {
      filename: `estadistica-cobranza-${data.desde}_${data.hasta}`,
      title: 'Estadistica de Cobranza',
      subtitle: `Periodo ${data.desde} a ${data.hasta}`,
      summary: [['Indice de cobranza', pct(t.indiceCobranza)], ['Facturado', moneyGT(t.facturado)], ['Cobrado', moneyGT(t.cobrado)], ['Cartera total', moneyGT(t.carteraTotal)], ['Cartera vencida', `${moneyGT(t.carteraVencida)} (${pct(t.porcentajeVencida)})`], ['Dias de cartera', `${t.diasCartera} dias`]],
      sections: [
        { title: 'Facturado vs cobrado por mes', columns: [{ header: 'Periodo' }, { header: 'Facturado', type: 'money' }, { header: 'Cobrado', type: 'money' }, { header: 'Indice', type: 'percent' }], rows: data.porMes.map((m) => [m.periodo, m.facturado, m.cobrado, m.facturado > 0 ? Math.round((m.cobrado / m.facturado) * 1000) / 10 : 0]), totals: ['TOTAL', t.facturado, t.cobrado, t.indiceCobranza] },
        { title: 'Pagos por forma de pago', columns: [{ header: 'Forma de pago' }, { header: 'Pagos', type: 'int' }, { header: 'Monto', type: 'money' }], rows: data.porFormaPago.map((f) => [f.formaPago, f.pagos, f.monto]) },
        { title: 'Promesas de pago', columns: [{ header: 'Estado' }, { header: 'Cantidad', type: 'int' }, { header: 'Monto', type: 'money' }], rows: data.promesas.map((p) => [p.estado, p.cantidad, p.monto]) },
        { title: 'Gestiones de cobro', columns: [{ header: 'Resultado' }, { header: 'Cantidad', type: 'int' }], rows: data.gestiones.map((g) => [g.resultado, g.cantidad]) },
        { title: 'Convenios de pago', columns: [{ header: 'Estado' }, { header: 'Cantidad', type: 'int' }, { header: 'Deuda convenida', type: 'money' }], rows: data.convenios.map((c) => [c.estado, c.cantidad, c.monto]) },
      ],
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estadística de Cobranza</h1>
          <p className="text-sm text-slate-500">Qué tanto de lo facturado se está cobrando, el estado de la cartera y el resultado de la gestión de cobro.</p>
        </div>
        <ExportMenu getSpec={getSpec} disabledReason={!data || data.porMes.length === 0 ? 'No hay datos en el periodo para exportar' : undefined} />
      </div>

      <RangoFechas {...rango} onChange={setRango} />
      {error && <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
      {isLoading && valido && <p className="text-sm text-slate-500">Cargando estadística…</p>}

      {data && valido && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile label="Índice de cobranza" value={pct(data.totales.indiceCobranza)} icon={Gauge} color="#1baf7a" caption={`${moneyGT(data.totales.cobrado)} de ${moneyGT(data.totales.facturado)}`} />
            <KpiTile label="Cobrado en el período" value={moneyGT(data.totales.cobrado)} icon={Wallet} color="#2a78d6" caption="Pagos aplicados confirmados" />
            <KpiTile label="Cartera vencida" value={pct(data.totales.porcentajeVencida)} icon={TriangleAlert} color="#c0392b" caption={`${moneyGT(data.totales.carteraVencida)} de ${moneyGT(data.totales.carteraTotal)}`} />
            <KpiTile label="Días de cartera" value={`${data.totales.diasCartera} días`} icon={CalendarClock} color="#4a3aa7" caption="Cartera ÷ venta diaria del período" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={card}>
              <h2 className="font-bold text-slate-900 mb-3">Cobrado por mes</h2>
              <TrendLineChart data={data.porMes.map((m) => ({ label: m.periodo, value: m.cobrado }))} valueFormatter={moneyGT} color="#1baf7a" />
            </section>
            <section className={card}>
              <h2 className="font-bold text-slate-900 mb-3">Promesas de pago</h2>
              <DonutChart items={data.promesas.map((p) => ({ key: p.estado, label: p.estado, value: p.cantidad, color: COLOR_PROMESA[p.estado] ?? '#64748b' }))}
                centerCaption="Promesas" emptyText="Sin promesas en el período" />
            </section>
          </div>

          <section className={card}>
            <h2 className="font-bold text-slate-900 mb-3">Facturado vs. cobrado por mes</h2>
            <DataTable data={data.porMes} emptyText="Sin movimientos en el período" columns={[
              { header: 'Período', accessorKey: 'periodo' },
              { header: 'Facturado', accessorKey: 'facturado', align: 'right', cell: ({ value }: any) => moneyGT(value) },
              { header: 'Cobrado', accessorKey: 'cobrado', align: 'right', cell: ({ value }: any) => moneyGT(value) },
              { header: 'Índice', align: 'right', cell: ({ row }: any) => (row.facturado > 0 ? pct((row.cobrado / row.facturado) * 100) : '—') },
            ]} />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={card}>
              <h2 className="font-bold text-slate-900 mb-3">Pagos por forma de pago</h2>
              <HorizontalBarList items={data.porFormaPago.map((f, i) => ({ key: f.formaPago, label: f.formaPago, value: f.monto, secondaryValue: f.pagos, color: PALETA[i % PALETA.length] }))}
                valueFormatter={moneyGT} secondaryFormatter={(n) => `${n} pagos`} emptyText="Sin pagos en el período" />
            </section>
            <section className={card}>
              <h2 className="font-bold text-slate-900 mb-3">Resultado de las gestiones de cobro</h2>
              <HorizontalBarList items={data.gestiones.map((g, i) => ({ key: g.resultado, label: g.resultado, value: g.cantidad, color: PALETA[i % PALETA.length] }))}
                emptyText="Sin gestiones en el período" />
            </section>
          </div>

          <section className={card}>
            <h2 className="font-bold text-slate-900 mb-3">Convenios de pago</h2>
            <DataTable data={data.convenios} emptyText="Sin convenios en el período" columns={[
              { header: 'Estado', cell: ({ row }: any) => <StatusBadge status={row.estado} /> },
              { header: 'Cantidad', accessorKey: 'cantidad', align: 'right' },
              { header: 'Deuda convenida', accessorKey: 'monto', align: 'right', cell: ({ value }: any) => moneyGT(value) },
            ]} />
          </section>
        </>
      )}
    </div>
  );
};
