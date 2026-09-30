import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
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
import type { AplicacionNotaCredito, CatalogoOption, NotaCredito } from '@erp/contracts';

interface AplicacionNotaCreditoFormProps { aplicacion?: AplicacionNotaCredito | null; onSuccess: () => void; onCancel: () => void; }

export const AplicacionNotaCreditoForm = ({ aplicacion, onSuccess, onCancel }: AplicacionNotaCreditoFormProps) => {
  const isEditing = !!aplicacion;
  const [notasCredito, setNotasCredito] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [notaSeleccionada, setNotaSeleccionada] = useState<NotaCredito | null>(null);
  const [idNotaCredito, setIdNotaCredito] = useState(aplicacion?.idNotaCredito?.toString() ?? '');
  const [idDocumento, setIdDocumento] = useState(aplicacion?.idDocumento?.toString() ?? '');
  const [idEmpleado, setIdEmpleado] = useState(aplicacion?.idEmpleado?.toString() ?? '');
  const [montoAplicado, setMontoAplicado] = useState(aplicacion?.montoAplicado?.toString() ?? '');
  const [fechaAplicacion, setFechaAplicacion] = useState(aplicacion?.fechaAplicacion?.slice(0, 10) ?? todayIso());
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { apiClient.get<CatalogoOption[]>('/cxc/catalogos/notas-credito').then(setNotasCredito).catch(() => setNotasCredito([])); }, []);
  useEffect(() => { apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados').then(setEmpleados).catch(() => setEmpleados([])); }, []);
  useEffect(() => {
    if (!idNotaCredito) { setDocumentos([]); setNotaSeleccionada(null); return; }
    let active = true;
    const load = async () => {
      try {
        const nota = await apiClient.get<NotaCredito>(`/cxc/notas-credito/${idNotaCredito}`);
        if (!active) return;
        setNotaSeleccionada(nota);
        const docs = await apiClient.get<CatalogoOption[]>(`/cxc/catalogos/clientes/${nota.idCliente}/documentos-pendientes`);
        if (active) setDocumentos(docs);
      } catch { if (active) { setNotaSeleccionada(null); setDocumentos([]); } }
    };
    void load(); return () => { active = false; };
  }, [idNotaCredito]);

  const selectedDocumento = documentos.find((d) => String(d.id) === idDocumento);
  const maxAplicable = Math.min(
    notaSeleccionada?.montoDisponible ?? Number.POSITIVE_INFINITY,
    selectedDocumento?.saldo ?? Number.POSITIVE_INFINITY,
  );

  const validate = (): ValidationErrors => {
    const next: ValidationErrors = {};
    const n = validateRequiredSelect(idNotaCredito, 'una nota de crédito'); if (n) next.idNotaCredito = n;
    const d = validateRequiredSelect(idDocumento, 'un documento'); if (d) next.idDocumento = d;
    const emp = validateRequiredSelect(idEmpleado, 'el empleado que aplica la nota de crédito'); if (emp) next.idEmpleado = emp;
    const m = validateMoney(montoAplicado, 'El monto aplicado', { required: true, positive: true }); if (m) next.montoAplicado = m;
    if (!m && Number.isFinite(maxAplicable) && Number(montoAplicado) > maxAplicable) next.montoAplicado = `El monto aplicado no puede superar ${maxAplicable.toFixed(2)}.`;
    const f = validateRequiredDate(fechaAplicacion, 'La fecha de aplicación', { notFuture: true }); if (f) next.fechaAplicacion = f;
    return next;
  };
  const isFormValid = useMemo(() => !hasErrors(validate()), [idNotaCredito, idDocumento, idEmpleado, montoAplicado, fechaAplicacion, notaSeleccionada, documentos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); const validationErrors = validate();
    if (hasErrors(validationErrors)) { setErrors(validationErrors); return; }
    setErrors({}); setFormError(null); setIsSubmitting(true);
    const payload = { idNotaCredito: Number(idNotaCredito), idDocumento: Number(idDocumento), idEmpleado: Number(idEmpleado), montoAplicado: Number(montoAplicado), fechaAplicacion };
    try {
      if (isEditing) await apiClient.patch(`/cxc/aplicaciones-nota-credito/${aplicacion!.idAplicacionNc}`, payload); else await apiClient.post('/cxc/aplicaciones-nota-credito', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) { const fe: ValidationErrors = {}; (err.details as Array<{campo:string;mensaje:string}>).forEach(x => fe[x.campo] = x.mensaje); setErrors(fe); }
      else setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la aplicación de nota de crédito');
    } finally { setIsSubmitting(false); }
  };

  return <form onSubmit={handleSubmit} className="flex flex-col gap-4">
    <Select label="Nota de Crédito" required value={idNotaCredito} onChange={(e:any)=>{setIdNotaCredito(e.target.value);setIdDocumento('');}} options={notasCredito.map(n=>({value:n.id,label:n.label}))} placeholder="Seleccionar nota de crédito" error={errors.idNotaCredito} helperText="Solo aparecen notas de crédito pendientes con saldo disponible." />
    <Select label="Documento" required value={idDocumento} onChange={(e:any)=>setIdDocumento(e.target.value)} options={documentos.map(d=>({value:d.id,label:d.label}))} placeholder={idNotaCredito?'Seleccionar documento':'Selecciona una nota de crédito primero'} isReadOnly={!idNotaCredito || !notaSeleccionada} error={errors.idDocumento} helperText="Solo aparecen documentos pendientes del mismo cliente de la nota." />
    <Select label="Empleado" required value={idEmpleado} onChange={(e:any)=>setIdEmpleado(e.target.value)} options={empleados.map(e=>({value:e.id,label:e.label}))} error={errors.idEmpleado} helperText="Empleado responsable de registrar la aplicación." />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Monto aplicado" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0.01" max={Number.isFinite(maxAplicable) ? String(maxAplicable) : undefined} required value={montoAplicado} onChange={(e:any)=>setMontoAplicado(e.target.value)} error={errors.montoAplicado} placeholder="0.00" helperText={Number.isFinite(maxAplicable) ? `No puede superar ${maxAplicable.toFixed(2)}, según nota y saldo del documento.` : 'Monto positivo, máximo 2 decimales.'} />
      <TextInput label="Fecha de aplicación" type="date" required max={todayIso()} value={fechaAplicacion} onChange={(e:any)=>setFechaAplicacion(e.target.value)} error={errors.fechaAplicacion} helperText="Fecha real de la aplicación; no puede ser futura." />
    </div>
    {formError && <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
    <FormActionButtons onCancel={onCancel} isSubmitting={isSubmitting} isEditing={isEditing} createLabel="Crear aplicación" isFormValid={isFormValid} />
  </form>;
};
