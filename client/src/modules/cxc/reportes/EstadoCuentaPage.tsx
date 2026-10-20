import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CatalogoOption, EstadoCuenta } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { apiClient } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import { useApi } from '../analisis/useApi';
import { COLOR, Q, entero } from '../analisis/format';
import { Encabezado, ErrorCaja, Esqueleto, Panel, Vacio } from '../analisis/ui/Panel';
import { KpiCard } from '../analisis/ui/KpiCard';
import { DataGrid } from '../analisis/ui/DataGrid';
import { EstadoPill } from '../analisis/ui/Pills';
import { useDetalle } from '../analisis/detalle/DetalleHost';

const selectCls = 'h-9 w-full max-w-md rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-800 outline-none hover:border-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100';
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const EstadoCuentaPage = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [idCliente, setIdCliente] = useState('');
  const { data: estado, loading, error, reload } = useApi<EstadoCuenta>(idCliente ? `/cxc/reportes/estado-cuenta/${idCliente}` : null);
  const { abrir, host } = useDetalle({ desde: hoy(), hasta: hoy() });

  useEffect(() => { apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([])); }, []);

  const getSpec = (): ReportSpec | null => {
    if (!estado) return null;
    const e = estado;
    return {
      filename: `estado-de-cuenta-${e.nombreCliente.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}`, title: 'Estado de Cuenta',
      subtitle: `${e.nombreCliente}  |  NIT ${e.nitCliente ?? 'sin NIT'}`, orientation: 'landscape',
      summary: [['Total facturado', Q(e.totalFacturado)], ['Saldo pendiente', Q(e.totalSaldoPendiente)], ['Saldo vencido', Q(e.totalVencido)]],
      sections: [{
        title: 'Documentos del cliente',
        columns: [{ header: 'Documento' }, { header: 'Tipo' }, { header: 'Fecha' }, { header: 'Vencimiento' }, { header: 'Total', type: 'money' }, { header: 'Saldo', type: 'money' }, { header: 'Estado' }],
        rows: e.documentos.map((d) => [d.referenciaDocumento, d.nombreTipoDocumento ?? '', formatDateGT(d.fechaDocumento), formatDateGT(d.fechaVencimiento), d.total, d.saldo, d.condicion === 'VENCIDA' ? `${d.estado} / VENCIDA` : d.estado]),
        totals: ['TOTAL', '', '', '', e.totalFacturado, e.totalSaldoPendiente, ''],
      }],
    };
  };

  return (
    <div>
      <Encabezado
        titulo="Estado de cuenta"
        descripcion="Historial completo de documentos de un cliente, con su saldo y condición de vencimiento. Clic en un documento para abrir su detalle."
        acciones={<ExportMenu getSpec={getSpec} disabledReason={!estado ? 'Selecciona un cliente para poder exportar' : undefined} />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3" role="search" aria-label="Cliente del estado de cuenta" data-tour="filters">
        <label htmlFor="ec-cliente" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cliente</label>
        <select id="ec-cliente" className={selectCls} value={idCliente} onChange={(e) => setIdCliente(e.target.value)}>
          <option value="">Selecciona un cliente…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        {estado && <button type="button" onClick={() => abrir({ tipo: 'cliente', id: Number(idCliente) })} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Ver ficha de riesgo</button>}
      </div>

      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {!idCliente && !error && <Panel titulo="Empieza eligiendo un cliente"><Vacio texto="Selecciona un cliente para ver su estado de cuenta" detalle="Verás cuánto ha facturado, cuánto debe y qué documentos están vencidos." /></Panel>}
      {loading && !estado && idCliente && <Esqueleto alto="h-72" />}

      {estado && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard etiqueta="Cliente" valor={estado.nombreCliente.length > 22 ? `${estado.nombreCliente.slice(0, 21)}…` : estado.nombreCliente} color={COLOR.azul} nota={`NIT ${estado.nitCliente ?? 'sin NIT'}`} />
            <KpiCard etiqueta="Total facturado" valor={Q(estado.totalFacturado)} color={COLOR.violeta} nota={`${entero(estado.documentos.length)} documentos`} />
            <KpiCard etiqueta="Saldo pendiente" valor={Q(estado.totalSaldoPendiente)} color={COLOR.naranja} nota="Lo que el cliente debe hoy" />
            <KpiCard etiqueta="Saldo vencido" valor={Q(estado.totalVencido)} color={COLOR.critico} nota={estado.totalVencido > 0 ? 'Requiere gestión de cobro' : 'Al día'} />
          </div>

          <Panel titulo="Documentos" subtitulo="Del más reciente al más antiguo" cargando={loading}>
            <DataGrid
              filas={estado.documentos} clave={(d) => d.idDocumento} porPagina={12} compacta vacio="Este cliente no tiene documentos registrados."
              buscar={(d) => `${d.referenciaDocumento} ${d.nombreTipoDocumento ?? ''}`} placeholderBuscar="Buscar documento…"
              onFila={(d) => navigate(`/cxc/documentos/documentos/${d.idDocumento}`)} etiquetaFila={(d) => `Abrir el documento ${d.referenciaDocumento}`}
              columnas={[
                { id: 'r', encabezado: 'Documento', valor: (d) => d.referenciaDocumento, render: (d) => <span className="font-medium text-slate-900">{d.referenciaDocumento}</span>, total: () => 'Total' },
                { id: 't', encabezado: 'Tipo', valor: (d) => d.nombreTipoDocumento },
                { id: 'f', encabezado: 'Fecha', valor: (d) => d.fechaDocumento, render: (d) => formatDateGT(d.fechaDocumento) },
                { id: 'v', encabezado: 'Vencimiento', valor: (d) => d.fechaVencimiento, render: (d) => formatDateGT(d.fechaVencimiento) },
                { id: 'to', encabezado: 'Total', alinear: 'der', valor: (d) => Number(d.total), render: (d) => Q(Number(d.total)), total: () => Q(estado.totalFacturado) },
                { id: 's', encabezado: 'Saldo', alinear: 'der', valor: (d) => Number(d.saldo), render: (d) => <strong>{Q(Number(d.saldo))}</strong>, total: () => Q(estado.totalSaldoPendiente) },
                { id: 'e', encabezado: 'Estado', valor: (d) => d.estado, render: (d) => <span className="flex items-center gap-1.5"><EstadoPill estado={d.estado} />{d.condicion === 'VENCIDA' && <EstadoPill estado="VENCIDO" />}</span> },
              ]} />
          </Panel>
        </div>
      )}
      {host}
    </div>
  );
};
