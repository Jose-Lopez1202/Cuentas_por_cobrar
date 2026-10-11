import { useState } from 'react';
import { Ban, Download, Eye, Plus, Search } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput } from '../../../shared/ui-kit';
import { Modal, TrazabilidadActionModal } from '../../../shared/components';
import { usePaginatedList } from '../../../shared/hooks';
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import { moneyGT } from '../../../shared/csv';
import type { FacturaFel, FacturaFelDetalle } from '@erp/contracts';
import { FacturaForm } from './components/FacturaForm';
import { downloadFacturaPdf } from '../../../shared/export/facturaPdf';

const PAGE_SIZE = 10;

const Dato = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium text-slate-900 break-all">{value}</p></div>
);

export const FacturasPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [emitirOpen, setEmitirOpen] = useState(false);
  const [detalle, setDetalle] = useState<FacturaFelDetalle | null>(null);
  const [aAnular, setAAnular] = useState<FacturaFel | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const descargarPdf = async (id: number, actual?: FacturaFelDetalle | null) => {
    setErrorDetalle(null); setGenerandoPdf(true);
    try {
      const factura = actual ?? await apiClient.get<FacturaFelDetalle>(`/cxc/facturas/${id}`);
      await downloadFacturaPdf(factura);
    } catch (err) {
      setErrorDetalle(err instanceof ApiError ? err.message : 'No se pudo generar el PDF de la factura');
    } finally { setGenerandoPdf(false); }
  };

  const { data, meta, isLoading, error, refetch } = usePaginatedList<FacturaFel>('/cxc/facturas', { page, limit: PAGE_SIZE, search });

  const verDetalle = async (id: number) => {
    setErrorDetalle(null);
    try {
      setDetalle(await apiClient.get<FacturaFelDetalle>(`/cxc/facturas/${id}`));
    } catch (err) {
      setErrorDetalle(err instanceof ApiError ? err.message : 'No se pudo cargar la factura');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturas (FEL)</h1>
          <p className="text-sm text-slate-500">
            Factura electrónica con certificación simulada de la SAT. Cada factura certificada crea su cuenta por cobrar.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setEmitirOpen(true)}>Emitir factura</Button>
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <TextInput icon={Search} placeholder="Buscar cliente, NIT, serie, número, UUID o estado..." value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1); }} className="max-w-md" />
      </div>

      {(error || errorDetalle) && (
        <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error ?? errorDetalle}</p>
      )}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="Todavía no se ha emitido ninguna factura"
        columns={[
          { header: 'Factura', cell: ({ row }: any) => `${row.serieFel}-${row.numeroFel}` },
          { header: 'Fecha', accessorKey: 'fechaEmision', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Receptor', cell: ({ row }: any) => <span>{row.nombreReceptor}<br /><span className="text-xs text-slate-500">NIT {row.nitReceptor}</span></span> },
          { header: 'IVA', accessorKey: 'iva', align: 'right', cell: ({ value }: any) => moneyGT(value) },
          { header: 'Total', accessorKey: 'total', align: 'right', cell: ({ value }: any) => moneyGT(value) },
          { header: 'Saldo', accessorKey: 'saldo', align: 'right', cell: ({ value }: any) => moneyGT(value) },
          { header: 'Estado FEL', cell: ({ row }: any) => <StatusBadge status={row.estado} /> },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) => {
              const anulable = row.estado === 'CERTIFICADA' && Math.abs(Number(row.total) - Number(row.saldo)) < 0.005;
              const motivo = row.estado === 'ANULADA'
                ? 'La factura ya está anulada'
                : !anulable ? 'La factura tiene pagos o ajustes aplicados; reversa esas aplicaciones primero' : 'Anular factura';
              return (
                <div className="flex justify-end gap-1">
                  <button onClick={() => verDetalle(row.idFacturaFel)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors" title="Ver certificado">
                    <Eye size={15} />
                  </button>
                  <button onClick={() => descargarPdf(row.idFacturaFel)} disabled={generandoPdf} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50" title="Descargar factura en PDF">
                    <Download size={15} />
                  </button>
                  <button onClick={() => anulable && setAAnular(row)} disabled={!anulable}
                    className={`p-1.5 rounded-md transition-colors ${anulable ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50' : 'text-slate-300 cursor-not-allowed'}`} title={motivo}>
                    <Ban size={15} />
                  </button>
                </div>
              );
            },
          },
        ]}
        paginationProps={{
          currentPage: meta.page,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          showingText: `Mostrando ${data.length} de ${meta.total} registros`,
        }}
      />

      <Modal isOpen={emitirOpen} onClose={() => setEmitirOpen(false)} title="Emitir factura" description="Se valida contra las reglas de la SAT (simulada) y se certifica al guardar." size="lg" closeOnBackdrop={false}>
        {emitirOpen && (
          <FacturaForm onCancel={() => setEmitirOpen(false)} onSuccess={(factura) => { setEmitirOpen(false); setDetalle(factura); refetch(); }} />
        )}
      </Modal>

      <Modal isOpen={!!detalle} onClose={() => setDetalle(null)} title={detalle ? `Factura ${detalle.serieFel}-${detalle.numeroFel}` : 'Factura'} description="Certificado generado por la SAT simulada." size="lg">
        {detalle && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 flex-1 min-w-[16rem]">
                SIMULACIÓN: este certificado no tiene validez fiscal; no fue emitido por la SAT.
              </p>
              <Button variant="secondary" icon={Download} disabled={generandoPdf} onClick={() => descargarPdf(detalle.idFacturaFel, detalle)}>
                {generandoPdf ? 'Generando...' : 'Descargar PDF'}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Dato label="UUID de autorización" value={detalle.uuidAutorizacion} />
              <Dato label="Estado" value={<StatusBadge status={detalle.estado} />} />
              <Dato label="Emisor" value={`${detalle.nombreEmisor} (NIT ${detalle.nitEmisor})`} />
              <Dato label="Receptor" value={`${detalle.nombreReceptor} (NIT ${detalle.nitReceptor})`} />
              <Dato label="Fecha de emisión" value={formatDateGT(detalle.fechaEmision)} />
              <Dato label="Fecha de certificación" value={formatDateGT(detalle.fechaCertificacion)} />
              {detalle.estado === 'ANULADA' && <Dato label="Anulación" value={`${formatDateGT(detalle.fechaAnulacion)} · ${detalle.motivoAnulacion ?? ''} · UUID ${detalle.uuidAnulacion ?? ''}`} />}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50"><tr><th className="p-2">Descripción</th><th className="p-2 text-right">Cant.</th><th className="p-2 text-right">Precio</th><th className="p-2 text-right">Total</th></tr></thead>
                <tbody>{detalle.lineas.map((l, i) => (
                  <tr key={i} className="border-t"><td className="p-2">{l.descripcion}</td><td className="p-2 text-right">{l.cantidad}</td><td className="p-2 text-right">{moneyGT(l.precioUnitario)}</td><td className="p-2 text-right">{moneyGT(l.total)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
              <Dato label="Base sin IVA" value={moneyGT(detalle.subtotalGravado)} />
              <Dato label="IVA (12%)" value={moneyGT(detalle.iva)} />
              <Dato label="Total" value={moneyGT(detalle.total)} />
            </div>
            <details className="rounded-lg border border-slate-200">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">Ver XML del DTE (simulado)</summary>
              <pre className="max-h-72 overflow-auto bg-slate-900 text-slate-100 text-xs p-3 rounded-b-lg whitespace-pre-wrap">{detalle.xmlDte ?? 'Sin XML'}</pre>
            </details>
          </div>
        )}
      </Modal>

      {aAnular && (
        <TrazabilidadActionModal
          title={`Anular factura ${aAnular.serieFel}-${aAnular.numeroFel}`}
          description="Se anula el DTE ante la SAT simulada, el documento por cobrar queda anulado y el saldo en cero."
          endpoint={`/cxc/facturas/${aAnular.idFacturaFel}/anular`}
          actionLabel="Anular factura"
          empleadoLabel="Empleado que anula"
          empleadoFieldName="idEmpleadoAnulacion"
          motivoLabel="Motivo de la anulación"
          motivoFieldName="motivoAnulacion"
          onClose={() => setAAnular(null)}
          onSuccess={() => { setAAnular(null); refetch(); }}
        />
      )}
    </div>
  );
};
