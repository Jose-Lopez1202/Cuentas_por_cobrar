import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, DollarSign, Save, X } from 'lucide-react';
import { DataTable, StatusBadge, Button, TextInput, Select } from '../../../shared/ui-kit';
import { Modal } from '../../../shared/components';
<<<<<<< HEAD
=======
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
>>>>>>> origin/develop
import { apiClient, ApiError } from '../../../shared/api';
import { formatDateGT } from '../../../shared/date';
import { validateRequiredSelect, validateMoney, validateIdentifier, hasErrors, type ValidationErrors } from '../../../shared/validation';
import type { ConvenioPago, ConvenioCuota, ConvenioDocumento, FormaPagoOption, CatalogoOption } from '@erp/contracts';

export const ConvenioDetallePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [convenio, setConvenio] = useState<ConvenioPago | null>(null);
  const [cuotas, setCuotas] = useState<ConvenioCuota[]>([]);
  const [documentos, setDocumentos] = useState<ConvenioDocumento[]>([]);
  const [formasPago, setFormasPago] = useState<FormaPagoOption[]>([]);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cuotaAPagar, setCuotaAPagar] = useState<ConvenioCuota | null>(null);
  const [montoPagado, setMontoPagado] = useState('');
  const [idFormaPago, setIdFormaPago] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [idEmpleado, setIdEmpleado] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isPaying, setIsPaying] = useState(false);
<<<<<<< HEAD
=======
  const [confirmPagoOpen, setConfirmPagoOpen] = useState(false);
>>>>>>> origin/develop
  const [payError, setPayError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    Promise.all([
      apiClient.get<ConvenioPago>(`/cxc/convenios-pago/${id}`),
      apiClient.get<ConvenioCuota[]>(`/cxc/convenios-pago/${id}/cuotas`),
      apiClient.get<ConvenioDocumento[]>(`/cxc/convenios-pago/${id}/documentos`),
    ])
      .then(([conv, cuotasList, documentosList]) => {
        setConvenio(conv);
        setCuotas(cuotasList);
        setDocumentos(documentosList);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el convenio'))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    apiClient.get<FormaPagoOption[]>('/cxc/catalogos/formas-pago').then(setFormasPago).catch(() => setFormasPago([]));
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados').then(setEmpleados).catch(() => setEmpleados([]));
  }, []);

  const formaPagoSeleccionada = formasPago.find((f) => f.id === Number(idFormaPago));

  const abrirModalPago = (cuota: ConvenioCuota) => {
    setCuotaAPagar(cuota);
    setMontoPagado(String(cuota.saldo));
    setIdFormaPago('');
    setReferenciaPago('');
    setIdEmpleado('');
    setErrors({});
    setPayError(null);
  };

  const validate = (): ValidationErrors => {
    const next: ValidationErrors = {};

    if (!montoPagado || montoPagado.trim() === '') {
      next.montoPagado = 'El monto pagado es obligatorio.';
    } else {
      const montoErr = validateMoney(montoPagado, 'El monto pagado', { required: true, positive: true });
      if (montoErr) {
        next.montoPagado = montoErr;
      } else if (cuotaAPagar && Number(montoPagado) > Number(cuotaAPagar.saldo)) {
        next.montoPagado = `No puede ser mayor al saldo pendiente (Q ${Number(cuotaAPagar.saldo).toFixed(2)}).`;
      }
    }

    const formaPagoErr = validateRequiredSelect(idFormaPago, 'una forma de pago');
    if (formaPagoErr) next.idFormaPago = formaPagoErr;

    const empleadoErr = validateRequiredSelect(idEmpleado, 'el empleado que registra el pago');
    if (empleadoErr) next.idEmpleado = empleadoErr;

    // La referencia es obligatoria SOLO si la forma de pago elegida lo exige
    // (cheque, transferencia, depósito...) — efectivo, por ejemplo, no.
    if (formaPagoSeleccionada?.requiereReferencia && (!referenciaPago || referenciaPago.trim() === '')) {
      next.referenciaPago = `${formaPagoSeleccionada.label} requiere un número de referencia.`;
    } else if (referenciaPago) {
      const referenciaErr = validateIdentifier(referenciaPago, 'La referencia');
      if (referenciaErr) next.referenciaPago = referenciaErr;
    }

    return next;
  };

  const payValidationErrors = useMemo(() => validate(), [
    montoPagado,
    idFormaPago,
    referenciaPago,
    idEmpleado,
    cuotaAPagar,
    formaPagoSeleccionada,
  ]);
  const isPayFormValid = !!cuotaAPagar && !hasErrors(payValidationErrors);

  const handlePagar = async () => {
<<<<<<< HEAD
=======
    setConfirmPagoOpen(false);
>>>>>>> origin/develop
    if (!cuotaAPagar) return;
    setPayError(null);

    const validationErrors = payValidationErrors;
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsPaying(true);

    try {
      await apiClient.post(`/cxc/convenios-pago/cuotas/${cuotaAPagar.idCuota}/pagos`, {
        montoPagado: Number(montoPagado),
        idFormaPago: Number(idFormaPago),
        referenciaPago: referenciaPago || undefined,
        idEmpleado: Number(idEmpleado),
      });
      setCuotaAPagar(null);
      cargar();
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'No se pudo registrar el pago');
    } finally {
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return <p className="text-slate-400 text-center py-12">Cargando convenio...</p>;
  }

  if (error || !convenio) {
    return <p className="text-red-600 text-center py-12">{error ?? 'Convenio no encontrado'}</p>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/cxc/cobranza/convenios-pago')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={15} /> Volver a Convenios de Pago
      </button>

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{convenio.nombreCliente}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Convenio del {formatDateGT(convenio.fechaConvenio)} · {convenio.numeroCuotas} cuotas
            </p>
          </div>
          <StatusBadge status={convenio.estado} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100 text-sm">
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold">Monto total</p>
            <p className="font-bold text-slate-900 mt-1">Q {Number(convenio.montoDeuda).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold">Saldo pendiente</p>
            <p className="font-bold text-slate-900 mt-1">
              Q {cuotas.reduce((acc, c) => acc + Number(c.saldo), 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 text-xs uppercase font-semibold">Cuotas pagadas</p>
            <p className="font-bold text-slate-900 mt-1">
              {cuotas.filter((c) => c.estado === 'PAGADA').length} / {cuotas.length}
            </p>
          </div>
        </div>
      </div>

      <DataTable
        data={cuotas}
        emptyText="Este convenio no tiene cuotas generadas"
        columns={[
          { header: '#', accessorKey: 'numeroCuota', align: 'center' },
          { header: 'Vencimiento', accessorKey: 'fechaVencimiento', cell: ({ value }: any) => formatDateGT(value) },
          { header: 'Monto', accessorKey: 'monto', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
          { header: 'Saldo', accessorKey: 'saldo', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
          { header: 'Forma de pago', cell: ({ row }: any) => row.nombreFormaPago ?? '—' },
          {
            header: 'Estado',
            cell: ({ row }: any) => (
              <div className="flex items-center gap-1.5">
                <StatusBadge status={row.estado} />
                {row.estaVencida && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600"
                    title="La fecha de vencimiento ya pasó sin registrar el pago completo"
                  >
                    <AlertTriangle size={12} />
                    Vencida
                  </span>
                )}
              </div>
            ),
          },
          {
            header: '',
            align: 'right',
            cell: ({ row }: any) =>
              row.estado !== 'PAGADA' ? (
                <button
                  onClick={() => abrirModalPago(row)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md transition-colors"
                >
                  <DollarSign size={13} /> Registrar pago
                </button>
              ) : null,
          },
        ]}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Documentos que cubre el convenio</h2>
          <p className="text-sm text-slate-500">Al pagar una cuota, el monto se distribuye entre estos documentos (el más antiguo primero) y les reduce el saldo real.</p>
        </div>
        <DataTable
          data={documentos}
          emptyText="Este convenio no tiene documentos vinculados"
          columns={[
            { header: 'Documento', accessorKey: 'referenciaDocumento' },
            { header: 'Monto incluido en el convenio', accessorKey: 'montoIncluido', cell: ({ value }: any) => `Q ${Number(value).toFixed(2)}` },
            { header: 'Saldo real actual', accessorKey: 'saldoActualDocumento', cell: ({ value }: any) => `Q ${Number(value ?? 0).toFixed(2)}` },
          ]}
        />
      </section>

      <Modal
        isOpen={!!cuotaAPagar}
        onClose={() => setCuotaAPagar(null)}
        title={`Registrar pago — Cuota ${cuotaAPagar?.numeroCuota}`}
        description={`Saldo actual: Q ${Number(cuotaAPagar?.saldo ?? 0).toFixed(2)}. Se aplicará al saldo real de los documentos del convenio.`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <TextInput
            label="Monto pagado"
            type="number"
            restriction="decimal"
            decimalPlaces={2}
            step="0.01"
            min="0.01"
            max={cuotaAPagar ? String(cuotaAPagar.saldo) : undefined}
            required
            value={montoPagado}
            onChange={(e: any) => setMontoPagado(e.target.value)}
            error={errors.montoPagado}
            helperText="No puede superar el saldo pendiente de la cuota."
          />

          <Select
            label="Forma de pago"
            required
            value={idFormaPago}
            onChange={(e: any) => { setIdFormaPago(e.target.value); setReferenciaPago(''); }}
            options={formasPago.map((f) => ({ value: f.id, label: f.label }))}
            error={errors.idFormaPago}
            helperText="Cómo se recibió el pago de esta cuota."
          />

          <Select
            label="Empleado"
            required
            value={idEmpleado}
            onChange={(e: any) => setIdEmpleado(e.target.value)}
            options={empleados.map((e) => ({ value: e.id, label: e.label }))}
            error={errors.idEmpleado}
            helperText="Empleado responsable de registrar el pago."
          />

          {formaPagoSeleccionada && (
            <TextInput
              label="Número de referencia"
              required={formaPagoSeleccionada.requiereReferencia}
              restriction="identifier"
              uppercase
              maxLength={50}
              value={referenciaPago}
              onChange={(e: any) => setReferenciaPago(e.target.value)}
              error={errors.referenciaPago}
              helperText={
                formaPagoSeleccionada.requiereReferencia
                  ? `${formaPagoSeleccionada.label} requiere número de referencia (boleta, cheque, transacción).`
                  : 'Opcional para esta forma de pago.'
              }
            />
          )}

          {payError && <p className="text-sm text-red-600 font-medium">{payError}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="danger" icon={X} onClick={() => setCuotaAPagar(null)} disabled={isPaying}>
              Cancelar
            </Button>
            <Button
              variant={isPayFormValid ? 'success' : 'primary'}
              icon={Save}
<<<<<<< HEAD
              onClick={handlePagar}
=======
              onClick={() => setConfirmPagoOpen(true)}
>>>>>>> origin/develop
              disabled={isPaying || !isPayFormValid}
              title={isPayFormValid ? 'Datos válidos: listo para registrar' : 'Revisa los campos y sus reglas'}
            >
              {isPaying ? 'Registrando...' : 'Registrar pago'}
            </Button>
          </div>
        </div>
      </Modal>
<<<<<<< HEAD
=======

      <ConfirmDialog
        isOpen={confirmPagoOpen}
        onClose={() => setConfirmPagoOpen(false)}
        onConfirm={handlePagar}
        title="Confirmar pago de cuota"
        description={`¿Estás seguro de registrar el pago de Q ${Number(montoPagado || 0).toFixed(2)} a la cuota ${cuotaAPagar?.numeroCuota ?? ''}? Se aplicará al saldo de los documentos del convenio.`}
        confirmLabel="Sí, registrar pago"
        variant="primary"
      />
>>>>>>> origin/develop
    </div>
  );
};