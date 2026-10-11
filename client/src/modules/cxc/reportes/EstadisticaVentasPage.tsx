import { useEffect, useState } from 'react';
import { FileText, Percent, Receipt, TrendingUp } from 'lucide-react';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { DonutChart, HorizontalBarList, KpiTile, TrendLineChart } from '../../../shared/charts';
import { apiClient, ApiError } from '../../../shared/api';
import { moneyGT } from '../../../shared/csv';
import type { EstadisticaVentas } from '@erp/contracts';
import { RangoFechas, rangoInicial, validarRango } from './components/RangoFechas';

const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7', '#008300', '#c2410c'];
const card = 'bg-white rounded-xl border border-slate-200 shadow-sm p-5';

export const EstadisticaVentasPage = () => {
  const [rango, setRango] = useState(rangoInicial());
  const [data, setData] = useState<EstadisticaVentas | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const errores = validarRango(rango.desde, rango.hasta);
  const valido = !errores.desde && !errores.hasta;

  useEffect(() => {
    if (!valido) return;
    setIsLoading(true); setError(null);
    apiClient.get<EstadisticaVentas>(`/cxc/reportes/estadistica-ventas?desde=${rango.desde}&hasta=${rango.hasta}`)
      .then(setData)
      .catch((err) => { setData(null); setError(err instanceof ApiError ? err.message : 'No se pudo cargar la estadística'); })
      .finally(() => setIsLoading(false));
  }, [rango.desde, rango.hasta, valido]);

  const getSpec = (): ReportSpec | null => {
    if (!data) return null;
    const t = data.totales;
    return {
      filename: `estadistica-ventas-${data.desde}_${data.hasta}`,
      title: 'Estadistica de Ventas',
      subtitle: `Periodo ${data.desde} a ${data.hasta}`,
      summary: [['Venta total', moneyGT(t.ventaTotal)], ['Venta neta', moneyGT(t.ventaNeta)], ['IVA facturado', moneyGT(t.iva)], ['Ticket promedio', moneyGT(t.ticketPromedio)], ['Facturas', String(t.facturas)], ['Anuladas', String(t.anuladas)]],
      sections: [
        { title: 'Ventas por mes', columns: [{ header: 'Periodo' }, { header: 'Facturas', type: 'int' }, { header: 'Venta total', type: 'money' }], rows: data.porMes.map((m) => [m.periodo, m.facturas, m.ventaTotal]), totals: ['TOTAL', t.facturas, t.ventaTotal] },
        { title: 'Mejores 10 clientes', columns: [{ header: 'Cliente' }, { header: 'Facturas', type: 'int' }, { header: 'Venta total', type: 'money' }], rows: data.topClientes.map((c) => [c.nombreCliente, c.facturas, c.ventaTotal]) },
        { title: 'Ventas por condicion de pago', columns: [{ header: 'Condicion' }, { header: 'Facturas', type: 'int' }, { header: 'Venta total', type: 'money' }], rows: data.porCondicion.map((c) => [c.condicion, c.facturas, c.ventaTotal]) },
      ],
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Estadística de Ventas</h1>
          <p className="text-sm text-slate-500">Ventas facturadas (FEL certificadas) del período, por mes, cliente y condición de pago.</p>
        </div>
        <ExportMenu getSpec={getSpec} disabledReason={!data || data.porMes.length === 0 ? 'No hay ventas en el periodo para exportar' : undefined} />
      </div>

      <RangoFechas {...rango} onChange={setRango} />
      {error && <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
      {isLoading && valido && <p className="text-sm text-slate-500">Cargando estadística…</p>}

      {data && valido && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile label="Venta total" value={moneyGT(data.totales.ventaTotal)} icon={TrendingUp} color="#2a78d6" caption={`${data.totales.facturas} facturas certificadas`} />
            <KpiTile label="Venta neta" value={moneyGT(data.totales.ventaNeta)} icon={Receipt} color="#1baf7a" caption="Sin IVA" />
            <KpiTile label="IVA facturado" value={moneyGT(data.totales.iva)} icon={Percent} color="#eb6834" caption="Débito fiscal" />
            <KpiTile label="Ticket promedio" value={moneyGT(data.totales.ticketPromedio)} icon={FileText} color="#4a3aa7" caption={`${data.totales.anuladas} facturas anuladas`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className={card}>
              <h2 className="font-bold text-slate-900 mb-3">Ventas por mes</h2>
              <TrendLineChart data={data.porMes.map((m) => ({ label: m.periodo, value: m.ventaTotal }))} valueFormatter={moneyGT} color="#2a78d6" />
            </section>
            <section className={card}>
              <h2 className="font-bold text-slate-900 mb-3">Ventas por condición de pago</h2>
              <DonutChart items={data.porCondicion.map((c, i) => ({ key: c.condicion, label: c.condicion, value: c.ventaTotal, color: PALETA[i % PALETA.length] }))}
                valueFormatter={moneyGT} centerCaption="Venta total" emptyText="Sin ventas en el período" />
            </section>
          </div>

          <section className={card}>
            <h2 className="font-bold text-slate-900 mb-3">Mejores 10 clientes</h2>
            <HorizontalBarList items={data.topClientes.map((c, i) => ({ key: String(c.idCliente), label: c.nombreCliente, value: c.ventaTotal, secondaryValue: c.facturas, color: PALETA[i % PALETA.length] }))}
              valueFormatter={moneyGT} secondaryFormatter={(n) => `${n} fact.`} emptyText="Sin ventas en el período" />
          </section>
        </>
      )}
    </div>
  );
};
