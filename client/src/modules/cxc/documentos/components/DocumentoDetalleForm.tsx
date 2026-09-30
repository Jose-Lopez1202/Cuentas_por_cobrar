import React, { useMemo, useState } from 'react';
import { TextInput, TextArea } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  validateIdentifier,
  validateMoney,
  validateRequired,
  validateRequiredNumber,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { DocumentoDetalle } from '@erp/contracts';

interface Props {
  idDocumento: number;
  detalle?: DocumentoDetalle | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const DocumentoDetalleForm = ({ idDocumento, detalle, onSuccess, onCancel }: Props) => {
  const isEditing = Boolean(detalle);
  const [codigoProducto, setCodigoProducto] = useState(detalle?.codigoProducto ?? '');
  const [descripcion, setDescripcion] = useState(detalle?.descripcion ?? '');
  const [cantidad, setCantidad] = useState(detalle?.cantidad?.toString() ?? '');
  const [precioUnitario, setPrecioUnitario] = useState(detalle?.precioUnitario?.toString() ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    if (codigoProducto) {
      const codigoErr = validateIdentifier(codigoProducto, 'El código de producto');
      if (codigoErr) next.codigoProducto = codigoErr;
    }

    const descErr = validateRequired(descripcion, 'La descripción');
    if (descErr) next.descripcion = descErr;
    else if (descripcion.trim().length > 200) next.descripcion = 'La descripción no puede superar 200 caracteres.';

    const cantidadErr = validateRequiredNumber(cantidad, 'La cantidad', {
      positive: true,
      decimalPlaces: 4,
    });
    if (cantidadErr) next.cantidad = cantidadErr;

    const precioErr = validateMoney(precioUnitario, 'El precio unitario', {
      required: true,
      min: 0,
    });
    if (precioErr) next.precioUnitario = precioErr;

    return next;
  }, [codigoProducto, descripcion, cantidad, precioUnitario]);

  const isFormValid = !hasErrors(validationErrors);
  const totalCalculado =
    isFormValid && cantidad && precioUnitario
      ? Number(Number(cantidad) * Number(precioUnitario)).toFixed(2)
      : '0.00';

  const errorFor = (field: string, value = '') =>
    errors[field] ?? (value ? validationErrors[field] : undefined);

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
      codigoProducto: codigoProducto.trim() || undefined,
      descripcion: descripcion.trim(),
      cantidad: Number(cantidad),
      precioUnitario: Number(precioUnitario),
    };

    try {
      if (isEditing) {
        await apiClient.patch(`/cxc/documentos/detalles/${detalle!.idDetalle}`, payload);
      } else {
        await apiClient.post(`/cxc/documentos/${idDocumento}/detalles`, payload);
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });
        setErrors(fieldErrors);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el detalle');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <TextInput
        label="Código de producto"
        restriction="identifier"
        uppercase
        maxLength={30}
        helperText="SKU o código; admite letras, números, -, _ y /."
        value={codigoProducto}
        onChange={(e: any) => setCodigoProducto(e.target.value)}
        error={errorFor('codigoProducto', codigoProducto)}
      />

      <TextArea
        label="Descripción"
        required
        value={descripcion}
        onChange={(e: any) => setDescripcion(e.target.value)}
        rows={3}
        maxLength={200}
        helperText="Descripción del concepto facturado; máximo 200 caracteres."
        error={errorFor('descripcion', descripcion)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Cantidad"
          type="number"
          restriction="decimal"
          decimalPlaces={4}
          min={0.0001}
          step="0.0001"
          required
          value={cantidad}
          onChange={(e: any) => setCantidad(e.target.value)}
          helperText="Mayor a 0; máximo 4 decimales."
          error={errorFor('cantidad', cantidad)}
        />
        <TextInput
          label="Precio unitario"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0}
          step="0.01"
          required
          value={precioUnitario}
          onChange={(e: any) => setPrecioUnitario(e.target.value)}
          helperText="No puede ser negativo; máximo 2 decimales."
          error={errorFor('precioUnitario', precioUnitario)}
        />
      </div>

      <TextInput
        label="Total calculado"
        value={totalCalculado}
        isReadOnly
        helperText="Cantidad × precio unitario. Se calcula en el servidor para evitar inconsistencias."
      />

      {formError && <p className="text-sm text-red-600 font-medium">{formError}</p>}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        isFormValid={isFormValid}
        createLabel="Agregar detalle"
      />
    </form>
  );
};
