import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  sanitizeSoloLetras,
  validateMoney,
  validateRequiredNumber,
  validateRequiredSelect,
  validateSoloLetras,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, RutaDetalle } from '@erp/contracts';
import { SearchableSelect } from '../../../../shared/components/SearchableSelect';

const ESTADOS_VISITA = ['PENDIENTE', 'VISITADO', 'NO_ENCONTRADO', 'REPROGRAMADO'] as const;
const ESTADO_OPTIONS = ESTADOS_VISITA.map((e) => ({ value: e, label: e.replace(/_/g, ' ') }));

// Horario permitido para las visitas (formato 24 horas).
const HORA_MIN = '08:00';
const HORA_MAX = '19:00';

// Dirección: solo letras, números, espacios y guion (-).
const DIRECCION_REGEX = /^[\p{L}\p{N}\s-]+$/u;
const sanitizeDireccion = (value: string) => value.replace(/[^\p{L}\p{N}\s-]/gu, '');

// Limpia datos viejos (guardados antes de estas reglas) al abrir Editar.
// Lo que no cumple se deja vacío; al guardar, se limpia también en la base de datos.
const horaInicial = (hora?: string | null) => {
  const h = hora?.slice(0, 5) ?? '';
  return h && h >= HORA_MIN && h <= HORA_MAX ? h : '';
};
const montoInicial = (monto?: number | null) =>
  monto !== null && monto !== undefined && monto > 0 ? monto.toString() : '';

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
  const [direccion, setDireccion] = useState(sanitizeDireccion(parada?.direccion ?? '').trim());
  const [montoPendiente, setMontoPendiente] = useState(montoInicial(parada?.montoPendiente));
  const [estadoVisita, setEstadoVisita] = useState(parada?.estadoVisita ?? 'PENDIENTE');
  const [horaVisita, setHoraVisita] = useState(horaInicial(parada?.horaVisita));
  const [observaciones, setObservaciones] = useState(sanitizeSoloLetras(parada?.observaciones ?? '').trim());
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
      const montoErr = validateMoney(montoPendiente, 'El monto pendiente', { positive: true });
      if (montoErr) next.montoPendiente = 'El monto pendiente debe ser mayor a 0; máximo 2 decimales.';
    }

    if (horaVisita && (horaVisita < HORA_MIN || horaVisita > HORA_MAX)) {
      next.horaVisita = `La hora de visita debe estar entre ${HORA_MIN} y ${HORA_MAX} (8:00 a. m. a 7:00 p. m.).`;
    }

    if (direccion.trim() && !DIRECCION_REGEX.test(direccion.trim())) {
      next.direccion = 'La dirección solo admite letras, números, espacios y guion (-).';
    }
    if (direccion.length > 200) next.direccion = 'La dirección no puede superar 200 caracteres.';

    const obsLetras = validateSoloLetras(observaciones, 'Las observaciones');
    if (obsLetras) next.observaciones = obsLetras;
    if (observaciones.length > 500) next.observaciones = 'Las observaciones no pueden superar 500 caracteres.';
    return next;
  }, [idCliente, ordenVisita, montoPendiente, horaVisita, direccion, observaciones]);

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
    // Al editar, un campo borrado se manda como null para que se limpie en la base de datos;
    // si se manda undefined, el servidor lo ignora y conserva el valor anterior.
    const vacio = isEditing ? null : undefined;
    const payload = {
      idCliente: Number(idCliente),
      ordenVisita: ordenVisita ? Number(ordenVisita) : vacio,
      direccion: direccion.trim() || vacio,
      montoPendiente: montoPendiente ? Number(montoPendiente) : vacio,
      estadoVisita: estadoVisita || undefined,
      horaVisita: horaVisita || vacio,
      observaciones: observaciones.trim() || vacio,
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
        <SearchableSelect
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
        onChange={(e: any) => setDireccion(sanitizeDireccion(e.target.value))}
        error={errors.direccion ?? (direccion ? validationErrors.direccion : undefined)}
        helperText="Letras, números, espacios y guion (-); máximo 200 caracteres."
        placeholder="Ej. 5a Avenida 10-25 Zona 1"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TextInput
          label="Hora de visita"
          type="time"
          min={HORA_MIN}
          max={HORA_MAX}
          value={horaVisita}
          onChange={(e: any) => setHoraVisita(e.target.value)}
          error={errors.horaVisita ?? (horaVisita ? validationErrors.horaVisita : undefined)}
          helperText="Entre 08:00 y 19:00 (8 a. m. a 7 p. m.); formato 24 horas."
        />
        <TextInput
          label="Monto pendiente"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          step="0.01"
          value={montoPendiente}
          onChange={(e: any) => setMontoPendiente(e.target.value)}
          error={errors.montoPendiente ?? (montoPendiente ? validationErrors.montoPendiente : undefined)}
          helperText="Monto de referencia; mayor a 0, máximo 2 decimales."
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
        helperText="Solo letras y espacios; máximo 500 caracteres."
        value={observaciones}
        onChange={(e: any) => setObservaciones(sanitizeSoloLetras(e.target.value))}
        rows={3}
        error={errors.observaciones ?? (observaciones ? validationErrors.observaciones : undefined)}
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
        isFormValid={isFormValid} blockers={validationErrors}
        createLabel="Agregar parada"
      />
    </form>
  );
};