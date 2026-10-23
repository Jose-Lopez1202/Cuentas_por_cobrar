import { useState } from 'react';
import type { LibroVentasFila, LibroVentasReporte } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { formatDateGT } from '../../../shared/date';
import { useApi } from '../analisis/useApi';
import { COLOR, Q, entero } from '../analisis/format';
import { Encabezado, ErrorCaja, Esqueleto, Panel } from '../analisis/ui/Panel';
import { KpiCard } from '../analisis/ui/KpiCard';
import { DataGrid } from '../analisis/ui/DataGrid';
import { Drawer } from '../analisis/ui/Drawer';
import { EstadoPill } from '../analisis/ui/Pills';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const selectCls = 'h-9 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100';

const Campo = ({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 border-b border-slate-100 py-2.5 text-[13px] last:border-0">
    <dt className="text-slate-500">{etiqueta}</dt>
    <dd className="break-all text-right font-medium text-slate-900">{valor}</dd>
  </div>
);

export const LibroVentasPage = () => {
  const hoy = new Date();
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  const [mes, setMes] = useState(String(hoy.getMonth() + 1));
  const [seleccion, setSeleccion] = useState<LibroVentasFila | null>(null);
  const { data: reporte, loading, error, reload } = useApi<LibroVentasReporte>('/cxc/reportes/libro-ventas', { anio, mes });
  const anios = Array.from({ length: 6 }, (_, i) => String(hoy.getFullYear() - i));
  const t = reporte?.totales;

  const getSpec = (): ReportSpec | null => {
    if (!reporte || !t) return null;
    return {
      filename: `libro-ventas-${anio}-${mes.padStart(2, '0')}`, title: 'Libro de Ventas', subtitle: `${MESES[Number(mes) - 1]} ${anio}  |  Facturas FEL emitidas`, orientation: 'landscape',
      summary: [['Facturas', String(t.facturas)], ['Anuladas', String(t.anuladas)], ['Base gravada', Q(t.baseGravada)], ['IVA debito fiscal', Q(t.iva)], ['Total ventas', Q(t.total)]],
      sections: [{
        title: 'Facturas del mes',
        columns: [{ header: 'Fecha' }, { header: 'Serie-Numero' }, { header: 'NIT' }, { header: 'Cliente' }, { header: 'Estado' }, { header: 'Base gravada', type: 'money' }, { header: 'IVA', type: 'money' }, { header: 'Total', type: 'money' }],
        rows: reporte.filas.map((f) => [formatDateGT(f.fecha), `${f.serie}-${f.numero}`, f.nitReceptor, f.nombreReceptor, f.estado, f.baseGravada, f.iva, f.total]),
        totals: ['TOTALES', '', '', '', '', t.baseGravada, t.iva, t.total],
      }],
    };
  };

  return (
    <div>
      <Encabezado
        titulo="Libro de ventas"
        descripcion="Facturas FEL emitidas en el mes, con base gravada e IVA. Las anuladas se listan con valores en cero. Clic en una factura para ver todos sus datos."
        acciones={<ExportMenu getSpec={getSpec} disabledReason={!reporte || reporte.filas.length === 0 ? 'No hay facturas en este mes para exportar' : undefined} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3" role="search" aria-label="Período del libro">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Período fiscal</span>
        <label className="sr-only" htmlFor="lv-mes">Mes</label>
        <select id="lv-mes" className={selectCls} value={mes} onChange={(e) => setMes(e.target.value)}>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <label className="sr-only" htmlFor="lv-anio">Año</label>
        <select id="lv-anio" className={selectCls} value={anio} onChange={(e) => setAnio(e.target.value)}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !reporte && <div className="space-y-4"><Esqueleto alto="h-[100px]" /><Esqueleto alto="h-80" /></div>}

      {reporte && t && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            <KpiCard etiqueta="Facturas" valor={entero(t.facturas)} color={COLOR.azul} nota={`${MESES[Number(mes) - 1]} ${anio}`} />
            <KpiCard etiqueta="Anuladas" valor={entero(t.anuladas)} color={COLOR.critico} nota="Se listan con valores en cero" />
            <KpiCard etiqueta="Base gravada" valor={Q(t.baseGravada)} color={COLOR.aqua} nota="Venta sin IVA" />
            <KpiCard etiqueta="IVA débito fiscal" valor={Q(t.iva)} color={COLOR.naranja} nota="12 % de la base" />
            <KpiCard etiqueta="Total ventas" valor={Q(t.total)} color={COLOR.violeta} nota="Base más IVA" />
          </div>

          <Panel titulo="Facturas del mes" subtitulo="Ordena por cualquier columna o busca por cliente, NIT o número" cargando={loading}>
            <DataGrid
              filas={reporte.filas} clave={(f) => f.uuid} porPagina={15} compacta vacio="No hay facturas emitidas en este mes."
              buscar={(f) => `${f.nombreReceptor} ${f.nitReceptor} ${f.serie}-${f.numero}`} placeholderBuscar="Buscar cliente, NIT o número…"
              onFila={(f) => setSeleccion(f)} etiquetaFila={(f) => `Ver factura ${f.serie}-${f.numero}`}
              columnas={[
                { id: 'f', encabezado: 'Fecha', valor: (f) => f.fecha, render: (f) => formatDateGT(f.fecha), total: () => 'Totales' },
                { id: 'n', encabezado: 'Serie-Número', valor: (f) => `${f.serie}-${f.numero}`, render: (f) => <span className="font-medium text-slate-900">{f.serie}-{f.numero}</span> },
                { id: 'nit', encabezado: 'NIT', valor: (f) => f.nitReceptor },
                { id: 'c', encabezado: 'Cliente', valor: (f) => f.nombreReceptor },
                { id: 'e', encabezado: 'Estado', valor: (f) => f.estado, render: (f) => <EstadoPill estado={f.estado === 'CERTIFICADA' ? 'COMPLETADA' : 'INCUMPLIDO'} /> },
                { id: 'b', encabezado: 'Base gravada', alinear: 'der', valor: (f) => f.baseGravada, render: (f) => Q(f.baseGravada), total: () => Q(t.baseGravada) },
                { id: 'i', encabezado: 'IVA', alinear: 'der', valor: (f) => f.iva, render: (f) => Q(f.iva), total: () => Q(t.iva) },
                { id: 't', encabezado: 'Total', alinear: 'der', valor: (f) => f.total, render: (f) => <strong>{Q(f.total)}</strong>, total: () => Q(t.total) },
              ]} />
          </Panel>
        </div>
      )}

      {seleccion && (
        <Drawer titulo={`Factura ${seleccion.serie}-${seleccion.numero}`} ancho="max-w-xl" onCerrar={() => setSeleccion(null)}
          subtitulo={<span>{formatDateGT(seleccion.fecha)} · {seleccion.estado === 'CERTIFICADA' ? 'Certificada por la SAT (simulada)' : 'Anulada'}</span>}>
          <Panel titulo="Datos del documento">
            <dl>
              <Campo etiqueta="Serie" valor={seleccion.serie} />
              <Campo etiqueta="Número" valor={seleccion.numero} />
              <Campo etiqueta="UUID de autorización" valor={<span className="font-mono text-[12px]">{seleccion.uuid}</span>} />
              <Campo etiqueta="Fecha de emisión" valor={formatDateGT(seleccion.fecha)} />
              <Campo etiqueta="Estado" valor={seleccion.estado === 'CERTIFICADA' ? 'Certificada' : 'Anulada'} />
            </dl>
          </Panel>
          <Panel titulo="Receptor">
            <dl>
              <Campo etiqueta="Nombre" valor={seleccion.nombreReceptor} />
              <Campo etiqueta="NIT" valor={seleccion.nitReceptor} />
            </dl>
          </Panel>
          <Panel titulo="Importes">
            <dl>
              <Campo etiqueta="Base gravada" valor={Q(seleccion.baseGravada)} />
              <Campo etiqueta="IVA (12 %)" valor={Q(seleccion.iva)} />
              <Campo etiqueta="Total" valor={<span className="text-base">{Q(seleccion.total)}</span>} />
            </dl>
            {seleccion.estado === 'ANULADA' && <p className="mt-3 text-[12px] text-slate-500">Las facturas anuladas se muestran con importes en cero porque no generan débito fiscal.</p>}
          </Panel>
          <p className="text-[12px] text-slate-500">Para descargar la factura en PDF o ver su XML, ve a Facturación → Facturas (FEL).</p>
        </Drawer>
      )}
    </div>
  );
};
