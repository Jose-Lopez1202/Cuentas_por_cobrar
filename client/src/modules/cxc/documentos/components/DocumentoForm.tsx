import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, StatusBadge } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  BUSINESS_DATE_MAX,
  BUSINESS_DATE_MIN,
  hasErrors,
  todayIso,
  validateIdentifier,
  validateMoney,
  validateRequired,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { Documento, DocumentoCatalogoOption } from '@erp/contracts';

interface Props {
  documento?: Documento | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const DocumentoForm = ({ documento, onSuccess, onCancel }: Props) => {
  const isEditing = Boolean(documento);
  const hasFinancialMovement = Boolean(
    documento && Math.abs(Number(documento.total) - Number(documento.saldo)) > 0.005,
  );
  const isTerminal = Boolean(
    documento && ['PAGADO', 'PAGADA', 'ANULADO', 'ANULADA'].includes(String(documento.estado).toUpperCase()),
  );
  const isLocked = hasFinancialMovement || isTerminal;

  const [clientes, setClientes] = useState<DocumentoCatalogoOption[]>([]);
  const [tipos, setTipos] = useState<DocumentoCatalogoOption[]>([]);
  const [monedas, setMonedas] = useState<DocumentoCatalogoOption[]>([]);
  const [condicionesCredito, setCondicionesCredito] = useState<DocumentoCatalogoOption[]>([]);

  const [idCliente, setIdCliente] = useState(documento?.idCliente?.toString() ?? '');
  const [nitCliente, setNitCliente] = useState(documento?.nitCliente ?? '');
  const [idTipoDocumento, setIdTipoDocumento] = useState(documento?.idTipoDocumento?.toString() ?? '');
  const [idMoneda, setIdMoneda] = useState(documento?.idMoneda?.toString() ?? '');
  const [idCondicionCredito, setIdCondicionCredito] = useState(documento?.idCondicionCredito?.toString() ?? '');
  const [serie, setSerie] = useState(documento?.serie ?? '');
  const [numeroDocumento, setNumeroDocumento] = useState(documento?.numeroDocumento ?? '');
  const [fechaDocumento, setFechaDocumento] = useState(documento?.fechaDocumento?.slice(0, 10) ?? '');
  const [fechaVencimiento, setFechaVencimiento] = useState(documento?.fechaVencimiento?.slice(0, 10) ?? '');
  const [total, setTotal] = useState(documento?.total?.toString() ?? '');

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/clientes'),
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/tipos-documento'),
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/monedas'),
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/condiciones-credito'),
    ])
      .then(([clientesData, tiposData, monedasData, condicionesData]) => {
        setClientes(clientesData);
        setTipos(tiposData);
        setMonedas(monedasData);
        setCondicionesCredito(condicionesData);

        if (documento?.idCliente) {
          const selected = clientesData.find((c) => c.id === documento.idCliente);
          if (selected?.nit !== undefined) setNitCliente(selected.nit ?? '');
        }
      })
      .catch(() => {
        setClientes([]);
        setTipos([]);
        setMonedas([]);
        setCondicionesCredito([]);
      });
  }, [documento?.idCliente]);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;

    const tipoErr = validateRequiredSelect(idTipoDocumento, 'un tipo de documento');
    if (tipoErr) next.idTipoDocumento = tipoErr;

    const monedaErr = validateRequiredSelect(idMoneda, 'una moneda');
    if (monedaErr) next.idMoneda = monedaErr;

    if (serie) {
      const serieErr = validateIdentifier(serie, 'La serie');
      if (serieErr) next.serie = serieErr;
    }

    const numeroRequired = validateRequired(numeroDocumento, 'El número de documento');
    if (numeroRequired) next.numeroDocumento = numeroRequired;
    else {
      const numeroErr = validateIdentifier(numeroDocumento, 'El número de documento');
      if (numeroErr) next.numeroDocumento = numeroErr;
    }

    const fechaDocumentoErr = validateRequiredDate(fechaDocumento, 'La fecha del documento', {
      notFuture: true,
      minDate: BUSINESS_DATE_MIN,
      maxDate: todayIso(),
    });
    if (fechaDocumentoErr) next.fechaDocumento = fechaDocumentoErr;

    const fechaVencimientoErr = validateRequiredDate(fechaVencimiento, 'La fecha de vencimiento', {
      minDate: BUSINESS_DATE_MIN,
      maxDate: BUSINESS_DATE_MAX,
      notBefore: fechaDocumento ? { date: fechaDocumento, label: 'la fecha del documento' } : undefined,
    });
    if (fechaVencimientoErr) next.fechaVencimiento = fechaVencimientoErr;

    const totalErr = validateMoney(total, 'El total', { required: true, positive: true });
    if (totalErr) next.total = totalErr;

    return next;
  }, [idCliente, idTipoDocumento, idMoneda, serie, numeroDocumento, fechaDocumento, fechaVencimiento, total]);

  const isFormValid = !hasErrors(validationErrors) && !isLocked;
  const errorFor = (field: string, value?: string) =>
    errors[field] ?? (value ? validationErrors[field] : undefined);

  const handleClienteChange = (value: string) => {
    setIdCliente(value);
    const selected = clientes.find((c) => String(c.id) === value);
    setNitCliente(selected?.nit ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isLocked) {
      setFormError('El documento ya tiene movimientos o está cerrado. Las correcciones deben hacerse mediante reversa, nota de crédito o ajuste autorizado.');
      return;
    }

    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const payload = {
      idCliente: Number(idCliente),
      idTipoDocumento: Number(idTipoDocumento),
      idMoneda: Number(idMoneda),
      idCondicionCredito: idCondicionCredito ? Number(idCondicionCredito) : null,
      serie: serie.trim() || undefined,
      numeroDocumento: numeroDocumento.trim(),
      fechaDocumento,
      fechaVencimiento,
      total: Number(total),
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/documentos/${documento!.idDocumento}`, payload);
      else await apiClient.post('/cxc/documentos', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el documento');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {isEditing && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">Estado financiero:</span>
            <StatusBadge status={documento?.estado} />
            {documento?.condicion === 'VENCIDA' && <StatusBadge status="VENCIDA" />}
            <span className="ml-auto text-slate-600">
              Saldo pendiente: <strong>Q {Number(documento?.saldo ?? 0).toFixed(2)}</strong>
            </span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este documento ya tiene movimientos financieros o está cerrado. Su cabecera queda bloqueada para proteger la trazabilidad.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Cliente"
          required
          value={idCliente}
          onChange={(e: any) => handleClienteChange(e.target.value)}
          options={clientes.map((c) => ({ value: c.id, label: c.label }))}
          helperText="Selecciona el cliente; el NIT se carga automáticamente desde el catálogo maestro."
          error={errorFor('idCliente')}
          isReadOnly={isLocked}
        />
        <TextInput
          label="NIT del cliente"
          value={nitCliente}
          isReadOnly
          helperText="Dato maestro del cliente. No se edita desde el documento."
          placeholder="Se carga al seleccionar el cliente"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Tipo de documento"
          required
          value={idTipoDocumento}
          onChange={(e: any) => setIdTipoDocumento(e.target.value)}
          options={tipos.map((t) => ({ value: t.id, label: t.label }))}
          helperText="Define la naturaleza contable del documento."
          error={errorFor('idTipoDocumento')}
          isReadOnly={isLocked}
        />
        <Select
          label="Moneda"
          required
          value={idMoneda}
          onChange={(e: any) => setIdMoneda(e.target.value)}
          options={monedas.map((m) => ({ value: m.id, label: m.label }))}
          helperText="Moneda en la que fue emitido el documento."
          error={errorFor('idMoneda')}
          isReadOnly={isLocked}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Serie"
          restriction="identifier"
          uppercase
          maxLength={30}
          helperText="Serie fiscal o interna; letras y números, admite -, _ y / (máx. 30)."
          value={serie}
          onChange={(e: any) => setSerie(e.target.value)}
          error={errorFor('serie', serie)}
          isReadOnly={isLocked}
        />
        <TextInput
          label="Número de documento"
          required
          restriction="identifier"
          uppercase
          maxLength={50}
          helperText="Correlativo o identificador del documento; máximo 50 caracteres."
          value={numeroDocumento}
          onChange={(e: any) => setNumeroDocumento(e.target.value)}
          error={errorFor('numeroDocumento', numeroDocumento)}
          isReadOnly={isLocked}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha del documento"
          type="date"
          required
          min={BUSINESS_DATE_MIN}
          max={todayIso()}
          value={fechaDocumento}
          onChange={(e: any) => setFechaDocumento(e.target.value)}
          helperText="Fecha de emisión; no puede ser futura."
          error={errorFor('fechaDocumento', fechaDocumento)}
          isReadOnly={isLocked}
        />
        <TextInput
          label="Fecha de vencimiento"
          type="date"
          required
          min={fechaDocumento || BUSINESS_DATE_MIN}
          max={BUSINESS_DATE_MAX}
          value={fechaVencimiento}
          onChange={(e: any) => setFechaVencimiento(e.target.value)}
          helperText="Debe ser igual o posterior a la fecha del documento."
          error={errorFor('fechaVencimiento', fechaVencimiento)}
          isReadOnly={isLocked}
        />
      </div>

      <Select
        label="Condición de crédito"
        value={idCondicionCredito}
        onChange={(e: any) => setIdCondicionCredito(e.target.value)}
        options={condicionesCredito.map((c) => ({ value: c.id, label: c.label }))}
        placeholder="Sin condición (no genera mora automática)"
        helperText="Opcional. Si se asigna, el documento entra al recálculo automático de mora al vencerse."
        isReadOnly={isLocked}
      />

      <TextInput
        label="Total"
        type="number"
        restriction="decimal"
        decimalPlaces={2}
        min={0.01}
        step="0.01"
        required
        value={total}
        onChange={(e: any) => setTotal(e.target.value)}
        helperText={isEditing ? 'Solo puede modificarse mientras el documento no tenga movimientos.' : 'El saldo inicial se genera automáticamente igual al total.'}
        error={errorFor('total', total)}
        isReadOnly={isLocked}
      />

      {formError && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        isFormValid={isFormValid}
        createLabel="Crear documento"
      />
    </form>
  );
};
