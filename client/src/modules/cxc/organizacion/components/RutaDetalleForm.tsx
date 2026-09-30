import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  validateMoney,
  validateRequiredNumber,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, RutaDetalle } from '@erp/contracts';

const ESTADOS_VISITA = ['PENDIENTE', 'VISITADO', 'NO_ENCONTRADO', 'REPROGRAMADO'] as const;
const ESTADO_OPTIONS = ESTADOS_VISITA.map((e) => ({ value: e, label: e.replace(/_/g, ' ') }));

interface RutaDetalleFormProps {
  idRuta: number;
  parada?: RutaDetalle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const RutaDetalleForm = ({ idRuta, parada, onSuccess, onCancel }: RutaDetalleFormProps) => {
  const isEditing = Boolean(parada);
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [idCliente, setIdCliente] = useState(parada?.idCliente?.toString() ?? '');
  const [ordenVisita, setOrdenVisita] = useState(parada?.ordenVisita?.toString() ?? '');
  const [direccion, setDireccion] = useState(parada?.direccion ?? '');
  const [montoPendiente, setMontoPendiente] = useState(parada?.montoPendiente?.toString() ?? '');
  const [estadoVisita, setEstadoVisita] = useState(parada?.estadoVisita ?? 'PENDIENTE');
  const [horaVisita, setHoraVisita] = useState(parada?.horaVisita?.slice(0, 5) ?? '');
  const [observaciones, setObservaciones] = useState(parada?.observaciones ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([]));
  }, []);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const clienteErr = validateRequiredSelect(idCliente, 'un cliente');
    if (clienteErr) next.idCliente = clienteErr;

    if (ordenVisita) {
      const ordenErr = validateRequiredNumber(ordenVisita, 'El orden de visita', { integer: true, positive: true });
      if (ordenErr) next.ordenVisita = ordenErr;
    }

    if (montoPendiente) {
      const montoErr = validateMoney(montoPendiente, 'El monto pendiente', { min: 0 });
      if (montoErr) next.montoPendiente = montoErr;
    }

    if (direccion.length > 200) next.direccion = 'La dirección no puede superar 200 caracteres.';
    if (observaciones.length > 500) next.observaciones = 'Las observaciones no pueden superar 500 caracteres.';
    return next;
  }, [idCliente, ordenVisita, montoPendiente, direccion, observaciones]);

  const isFormValid = !hasErrors(validationErrors);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    const payload = {
      idCliente: Number(idCliente),
      ordenVisita: ordenVisita ? Number(ordenVisita) : undefined,
      direccion: direccion.trim() || undefined,
      montoPendiente: montoPendiente ? Number(montoPendiente) : undefined,
      estadoVisita: estadoVisita || undefined,
      horaVisita: horaVisita || undefined,
      observaciones: observaciones.trim() || undefined,
    };

    try {
      if (isEditing) await apiClient.patch(`/cxc/rutas/detalle/${parada!.idRutaDetalle}`, payload);
      else await apiClient.post(`/cxc/rutas/${idRuta}/detalle`, payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar la parada');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Cliente"
          required
          value={idCliente}
          onChange={(e: any) => setIdCliente(e.target.value)}
          options={clientes.map((c) => ({ value: c.id, label: c.label }))}
          helperText="Cliente que será visitado en esta parada."
          error={errors.idCliente}
        />
        <TextInput
          label="Orden de visita"
          type="number"
          restriction="integer"
          min={1}
          value={ordenVisita}
          onChange={(e: any) => setOrdenVisita(e.target.value)}
          error={errors.ordenVisita ?? (ordenVisita ? validationErrors.ordenVisita : undefined)}
          helperText="Solo números enteros positivos."
          placeholder="Ej. 1"
        />
      </div>

      <TextInput
        label="Dirección"
        maxLength={200}
        value={direccion}
        onChange={(e: any) => setDireccion(e.target.value)}
        error={errors.direccion}
        helperText="Dirección de la visita; máximo 200 caracteres."
        placeholder="Opcional"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TextInput
          label="Hora de visita"
          type="time"
          value={horaVisita}
          onChange={(e: any) => setHoraVisita(e.target.value)}
          error={errors.horaVisita}
          helperText="Usa el selector de hora; formato 24 horas."
        />
        <TextInput
          label="Monto pendiente"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0}
          step="0.01"
          value={montoPendiente}
          onChange={(e: any) => setMontoPendiente(e.target.value)}
          error={errors.montoPendiente ?? (montoPendiente ? validationErrors.montoPendiente : undefined)}
          helperText="Monto de referencia; no negativo, máximo 2 decimales."
        />
        <Select
          label="Estado de visita"
          value={estadoVisita}
          onChange={(e: any) => setEstadoVisita(e.target.value)}
          options={ESTADO_OPTIONS}
          helperText="Selecciona un estado controlado; no admite texto libre."
        />
      </div>

      <TextArea
        label="Observaciones"
        maxLength={500}
        helperText="Información útil para la visita o seguimiento; máximo 500 caracteres."
        value={observaciones}
        onChange={(e: any) => setObservaciones(e.target.value)}
        rows={3}
        error={errors.observaciones}
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
        createLabel="Agregar parada"
      />
    </form>
  );
};
