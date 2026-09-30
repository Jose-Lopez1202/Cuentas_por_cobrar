import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  todayIso,
  validateMoney,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { Ajuste, DocumentoCatalogoOption } from '@erp/contracts';

const TIPO_OPTIONS = [
  { value: 'DEBITO', label: 'Débito — aumenta el saldo' },
  { value: 'CREDITO', label: 'Crédito — reduce el saldo' },
];

interface Props {
  ajuste?: Ajuste | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AjusteForm = ({ ajuste, onSuccess, onCancel }: Props) => {
  const isEditing = Boolean(ajuste);
  const isLocked = isEditing && ajuste!.estado !== 'PENDIENTE';
  const [clientes, setClientes] = useState<DocumentoCatalogoOption[]>([]);
  const [empleados, setEmpleados] = useState<DocumentoCatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCatalogoOption[]>([]);

  const [idCliente, setIdCliente] = useState(ajuste?.idCliente?.toString() ?? '');
  const [idDocumento, setIdDocumento] = useState(ajuste?.idDocumento?.toString() ?? '');
  const [tipoAjuste, setTipoAjuste] = useState(ajuste?.tipoAjuste ?? '');
  const [monto, setMonto] = useState(ajuste?.monto?.toString() ?? '');
  const [motivo, setMotivo] = useState(ajuste?.motivo ?? '');
  const [fecha, setFecha] = useState(ajuste?.fecha?.slice(0, 10) ?? todayIso());
  const [idEmpleado, setIdEmpleado] = useState(ajuste?.idEmpleado?.toString() ?? '');

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/clientes'),
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/empleados'),
    ])
      .then(([clientesData, empleadosData]) => {
        setClientes(clientesData);
        setEmpleados(empleadosData);
      })
      .catch(() => {
        setClientes([]);
        setEmpleados([]);
      });
  }, []);

  useEffect(() => {
    if (!idCliente) {
      setDocumentos([]);
      setIdDocumento('');
      return;
    }
    apiClient
      .get<DocumentoCatalogoOption[]>(`/cxc/documentos/catalogos/clientes/${idCliente}/documentos`)
      .then(setDocumentos)
      .catch(() => setDocumentos([]));
  }, [idCliente]);

  const selectedDocumento = documentos.find((d) => String(d.id) === idDocumento);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;

    if (!['DEBITO', 'CREDITO'].includes(tipoAjuste)) {
      next.tipoAjuste = 'Selecciona Débito o Crédito.';
    }

    const montoErr = validateMoney(monto, 'El monto', { required: true, positive: true });
    if (montoErr) next.monto = montoErr;
    if (
      !montoErr &&
      tipoAjuste === 'CREDITO' &&
      selectedDocumento?.saldo !== undefined &&
      Number(monto) > Number(selectedDocumento.saldo)
    ) {
      next.monto = `El crédito no puede superar el saldo pendiente (Q ${Number(selectedDocumento.saldo).toFixed(2)}).`;
    }

    const fechaErr = validateRequiredDate(fecha, 'La fecha', { notFuture: true, maxDate: todayIso() });
    if (fechaErr) next.fecha = fechaErr;

    const empleadoErr = validateRequiredSelect(idEmpleado, 'un empleado');
    if (empleadoErr) next.idEmpleado = empleadoErr;

    if (motivo.trim().length < 10) next.motivo = 'Describe el motivo del ajuste con al menos 10 caracteres.';
    else if (motivo.length > 250) next.motivo = 'El motivo no puede superar 250 caracteres.';
    return next;
  }, [idCliente, tipoAjuste, monto, fecha, idEmpleado, motivo, selectedDocumento]);

  const isFormValid = !hasErrors(validationErrors) && !isLocked;
  const errorFor = (field: string, value = '') =>
    errors[field] ?? (value ? validationErrors[field] : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (isLocked) {
      setFormError('Este ajuste ya fue procesado y su cabecera queda bloqueada.');
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
      idDocumento: idDocumento ? Number(idDocumento) : undefined,
      tipoAjuste,
      monto: Number(monto),
      motivo: motivo.trim(),
      fecha,
      idEmpleado: Number(idEmpleado),
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/ajustes/${ajuste!.idAjuste}`, payload);
      else await apiClient.post('/cxc/ajustes', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el ajuste');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Control financiero:</strong> un ajuste nace PENDIENTE y no modifica el saldo. El efecto se aplica únicamente cuando se aprueba desde la lista de ajustes.
      </div>

      {isLocked && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Este ajuste ya fue {ajuste?.estado?.toLowerCase()} y su cabecera queda bloqueada para proteger la trazabilidad.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Cliente"
          required
          value={idCliente}
          onChange={(e: any) => { setIdCliente(e.target.value); setIdDocumento(''); }}
          options={clientes.map((c) => ({ value: c.id, label: c.label }))}
          helperText="El documento se filtrará por el cliente seleccionado."
          error={errorFor('idCliente')}
          isReadOnly={isLocked}
        />
        <Select
          label="Documento"
          value={idDocumento}
          onChange={(e: any) => setIdDocumento(e.target.value)}
          options={documentos.map((d) => ({ value: d.id, label: d.label }))}
          placeholder={idCliente ? 'Seleccionar documento (opcional)' : 'Selecciona un cliente primero'}
          isReadOnly={!idCliente || isLocked}
          helperText="Opcional; solo se muestran documentos del cliente seleccionado."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Tipo de ajuste"
          required
          value={tipoAjuste}
          onChange={(e: any) => setTipoAjuste(e.target.value)}
          options={TIPO_OPTIONS}
          helperText="Débito aumenta la deuda; Crédito la reduce cuando el ajuste sea aprobado."
          error={errorFor('tipoAjuste', tipoAjuste)}
          isReadOnly={isLocked}
        />
        <TextInput
          label="Monto"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          step="0.01"
          required
          value={monto}
          onChange={(e: any) => setMonto(e.target.value)}
          helperText={
            tipoAjuste === 'CREDITO' && selectedDocumento?.saldo !== undefined
              ? `Máximo según saldo pendiente: Q ${Number(selectedDocumento.saldo).toFixed(2)}.`
              : 'Monto mayor a 0 y máximo 2 decimales.'
          }
          error={errorFor('monto', monto)}
          isReadOnly={isLocked}
        />
      </div>

      <TextArea
        label="Motivo"
        required
        maxLength={250}
        helperText="Obligatorio. Explica la razón y soporte del ajuste (10–250 caracteres)."
        value={motivo}
        onChange={(e: any) => setMotivo(e.target.value)}
        rows={3}
        error={errorFor('motivo', motivo)}
        isReadOnly={isLocked}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha"
          type="date"
          required
          max={todayIso()}
          value={fecha}
          onChange={(e: any) => setFecha(e.target.value)}
          helperText="Fecha del ajuste; no puede ser futura."
          error={errorFor('fecha', fecha)}
          isReadOnly={isLocked}
        />
        <Select
          label="Empleado solicitante"
          required
          value={idEmpleado}
          onChange={(e: any) => setIdEmpleado(e.target.value)}
          options={empleados.map((e) => ({ value: e.id, label: e.label }))}
          helperText="Empleado responsable de solicitar/registrar el ajuste."
          error={errorFor('idEmpleado')}
          isReadOnly={isLocked}
        />
      </div>

      {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        isFormValid={isFormValid}
        createLabel="Registrar ajuste"
      />
    </form>
  );
};
