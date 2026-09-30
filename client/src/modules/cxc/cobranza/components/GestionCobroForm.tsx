import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  todayIso,
  validateRequiredSelect,
  validateMoney,
  validateDate,
  validateMaxLength,
  hasErrors,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, GestionCobro } from '@erp/contracts';

interface GestionCobroFormProps {
  gestion?: GestionCobro | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const TIPOS_GESTION_COBRO = ['LLAMADA', 'VISITA', 'EMAIL', 'WHATSAPP', 'CARTA', 'OTRO'] as const;
const TIPO_OPTIONS = TIPOS_GESTION_COBRO.map((t) => ({ value: t, label: t }));

export const GestionCobroForm = ({ gestion, onSuccess, onCancel }: GestionCobroFormProps) => {
  const isEditing = !!gestion;
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);
  const [idCliente, setIdCliente] = useState(gestion?.idCliente?.toString() ?? '');
  const [idEmpleado, setIdEmpleado] = useState(gestion?.idEmpleado?.toString() ?? '');
  const [idDocumento, setIdDocumento] = useState(gestion?.idDocumento?.toString() ?? '');
  const [tipoGestion, setTipoGestion] = useState(gestion?.tipoGestion ?? '');
  const [resultado, setResultado] = useState(gestion?.resultado ?? '');
  const [observacion, setObservacion] = useState(gestion?.observacion ?? '');
  const [fechaCompromiso, setFechaCompromiso] = useState(gestion?.fechaCompromiso?.slice(0, 10) ?? '');
  const [montoCompromiso, setMontoCompromiso] = useState(gestion?.montoCompromiso?.toString() ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([]));
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados').then(setEmpleados).catch(() => setEmpleados([]));
  }, []);

  useEffect(() => {
    if (!idCliente) { setDocumentos([]); return; }
    apiClient.get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/documentos-pendientes`)
      .then(setDocumentos).catch(() => setDocumentos([]));
  }, [idCliente]);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;
    const empleadoErr = validateRequiredSelect(idEmpleado, 'un empleado responsable');
    if (empleadoErr) next.idEmpleado = empleadoErr;
    const resultadoErr = validateMaxLength(resultado, 'Resultado', 80);
    if (resultadoErr) next.resultado = resultadoErr;
    const observacionErr = validateMaxLength(observacion, 'Observación', 500);
    if (observacionErr) next.observacion = observacionErr;
    const fechaErr = validateDate(fechaCompromiso, 'La fecha de compromiso', { notPast: true });
    if (fechaErr) next.fechaCompromiso = fechaErr;
    const montoErr = validateMoney(montoCompromiso, 'El monto comprometido', { positive: true });
    if (montoErr) next.montoCompromiso = montoErr;
    return next;
  }, [idCliente, idEmpleado, resultado, observacion, fechaCompromiso, montoCompromiso]);

  const isFormValid = !hasErrors(validationErrors);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isFormValid) { setErrors(validationErrors); return; }
    setErrors({});
    setIsSubmitting(true);
    const payload = {
      idCliente: Number(idCliente),
      idEmpleado: Number(idEmpleado),
      idDocumento: idDocumento ? Number(idDocumento) : undefined,
      tipoGestion: tipoGestion || undefined,
      resultado: resultado.trim() || undefined,
      observacion: observacion.trim() || undefined,
      fechaCompromiso: fechaCompromiso || undefined,
      montoCompromiso: montoCompromiso ? Number(montoCompromiso) : undefined,
    };
    try {
      if (isEditing) await apiClient.patch(`/cxc/gestiones-cobro/${gestion!.idGestion}`, payload);
      else await apiClient.post('/cxc/gestiones-cobro', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => { fieldErrors[d.campo] = d.mensaje; });
        setErrors(fieldErrors);
      } else setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la gestión');
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Cliente" required value={idCliente} onChange={(e: any) => { setIdCliente(e.target.value); setIdDocumento(''); }} options={clientes.map((c) => ({ value: c.id, label: c.label }))} error={errors.idCliente} helperText="Cliente al que se realizó la gestión; campo obligatorio." />
        <Select label="Empleado responsable" required value={idEmpleado} onChange={(e: any) => setIdEmpleado(e.target.value)} options={empleados.map((emp) => ({ value: emp.id, label: emp.label }))} error={errors.idEmpleado} helperText="Persona responsable del contacto con el cliente." />
      </div>
      <Select label="Documento relacionado" value={idDocumento} onChange={(e: any) => setIdDocumento(e.target.value)} options={documentos.map((d) => ({ value: d.id, label: d.label }))} placeholder={idCliente ? 'Seleccionar documento (opcional)' : 'Selecciona un cliente primero'} isReadOnly={!idCliente} helperText="Opcional; solo aparecen documentos con saldo pendiente del cliente seleccionado." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Tipo de gestión" value={tipoGestion} onChange={(e: any) => setTipoGestion(e.target.value)} options={TIPO_OPTIONS} helperText="Canal utilizado para contactar al cliente." />
        <TextInput label="Resultado" value={resultado} onChange={(e: any) => setResultado(e.target.value)} placeholder="Ej. Cliente confirma pago" maxLength={80} error={errors.resultado} helperText="Resumen breve del resultado; máximo 80 caracteres." />
      </div>
      <TextArea label="Observación" value={observacion} onChange={(e: any) => setObservacion(e.target.value)} rows={3} maxLength={500} error={errors.observacion} helperText="Detalle adicional de la conversación o visita; máximo 500 caracteres." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="Fecha compromiso" type="date" min={todayIso()} value={fechaCompromiso} onChange={(e: any) => setFechaCompromiso(e.target.value)} error={errors.fechaCompromiso} helperText="Solo si existe compromiso; no puede ser anterior a hoy." />
        <TextInput label="Monto comprometido" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0.01" value={montoCompromiso} onChange={(e: any) => setMontoCompromiso(e.target.value)} error={errors.montoCompromiso} helperText="Monto prometido, mayor a 0 y con máximo 2 decimales." />
      </div>
      {!isEditing && fechaCompromiso && montoCompromiso && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          Al guardar se creará automáticamente una Promesa de Pago vinculada a esta gestión, con esta fecha y monto.
        </p>
      )}
      {formError && <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
      <FormActionButtons onCancel={onCancel} isSubmitting={isSubmitting} isEditing={isEditing} createLabel="Crear gestión" isFormValid={isFormValid} />
    </form>
  );
};
