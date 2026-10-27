
import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea, StatusBadge } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  validateIdentifier,
  validateMaxLength,
  validateMoney,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, NotaCredito } from '@erp/contracts';
import { SearchableSelect } from '../../../../shared/components/SearchableSelect';

interface NotaCreditoFormProps {
  nota?: NotaCredito | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// Fecha actual de Guatemala en formato YYYY-MM-DD.
function hoyGuatemalaIso(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obtener = (tipo: string): string =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
}

export const NotaCreditoForm = ({
  nota,
  onSuccess,
  onCancel,
}: NotaCreditoFormProps) => {
  const isEditing = !!nota;

  const hasApplications = Number(nota?.montoAplicado ?? 0) > 0.005;

  const terminalState = ['APLICADA', 'ANULADA'].includes(
    String(nota?.estado ?? '').toUpperCase(),
  );

  const isLocked = hasApplications || terminalState;

  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);

  const [idCliente, setIdCliente] = useState(
    nota?.idCliente?.toString() ?? '',
  );

  const [idDocumentoReferencia, setIdDocumentoReferencia] = useState(
    nota?.idDocumentoReferencia?.toString() ?? '',
  );

  const [descripcion, setDescripcion] = useState(
    nota?.descripcion ?? '',
  );

  const [serie, setSerie] = useState(nota?.serie ?? '');
  const [numero, setNumero] = useState(nota?.numero ?? '');

  // Al crear, utilizar la fecha actual de Guatemala.
  // Al editar, conservar la fecha original de la nota.
  const [fecha, setFecha] = useState(
    () => nota?.fecha?.slice(0, 10) ?? hoyGuatemalaIso(),
  );

  const [monto, setMonto] = useState(
    nota?.monto?.toString() ?? '',
  );

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hoy = hoyGuatemalaIso();

  // =====================================================
  // CARGAR CLIENTES
  // =====================================================

  useEffect(() => {
    let activo = true;

    apiClient
      .get<CatalogoOption[]>('/cxc/catalogos/clientes')
      .then((data) => {
        if (activo) setClientes(data);
      })
      .catch(() => {
        if (activo) setClientes([]);
      });

    return () => {
      activo = false;
    };
  }, []);

  // =====================================================
  // CARGAR DOCUMENTOS DEL CLIENTE
  // =====================================================

  useEffect(() => {
    if (!idCliente) {
      setDocumentos([]);
      return;
    }

    let activo = true;
    setDocumentos([]);

    apiClient
      .get<CatalogoOption[]>(
        `/cxc/catalogos/clientes/${encodeURIComponent(idCliente)}/documentos-pendientes`,
      )
      .then((data) => {
        if (activo) setDocumentos(data);
      })
      .catch(() => {
        if (activo) setDocumentos([]);
      });

    return () => {
      activo = false;
    };
  }, [idCliente]);

  const selectedDocumento = documentos.find(
    (documento) => String(documento.id) === idDocumentoReferencia,
  );

  // =====================================================
  // VALIDACIONES DEL FORMULARIO
  // =====================================================

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const clienteErr = validateRequiredSelect(
      idCliente,
      'un cliente',
    );

    if (clienteErr) {
      next.idCliente = clienteErr;
    }

    if (serie) {
      const serieErr = validateIdentifier(serie, 'La serie');

      if (serieErr) {
        next.serie = serieErr;
      }
    }

    if (numero) {
      const numeroErr = validateIdentifier(numero, 'El número');

      if (numeroErr) {
        next.numero = numeroErr;
      }
    }

    // La fecha no puede ser futura.
    // Se utiliza como límite la fecha de negocio de Guatemala.
    const fechaErr = validateRequiredDate(
      fecha,
      'La fecha',
      {
        notFuture: true,
        maxDate: hoy,
      },
    );

    if (fechaErr) {
      next.fecha = fechaErr;
    }

    const montoErr = validateMoney(
      monto,
      'El monto',
      {
        required: true,
        positive: true,
      },
    );

    if (montoErr) {
      next.monto = montoErr;
    }

    if (
      !montoErr &&
      selectedDocumento?.saldo !== undefined &&
      Number(monto) > Number(selectedDocumento.saldo)
    ) {
      next.monto =
        'El monto no puede superar el saldo pendiente del documento seleccionado.';
    }

    const descripcionErr = validateMaxLength(
      descripcion,
      'La descripción',
      250,
    );

    if (descripcionErr) {
      next.descripcion = descripcionErr;
    }

    return next;
  }, [
    idCliente,
    serie,
    numero,
    fecha,
    monto,
    descripcion,
    selectedDocumento,
    hoy,
  ]);

  const isFormValid =
    !hasErrors(validationErrors) &&
    !isLocked &&
    !isSubmitting;

  // =====================================================
  // CAMBIO DE CLIENTE
  // =====================================================

  const handleClienteChange = (value: string) => {
    setIdCliente(value);
    setIdDocumentoReferencia('');
    setDocumentos([]);
    setErrors({});
    setFormError(null);
  };

  // =====================================================
  // GUARDAR NOTA DE CRÉDITO
  // =====================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormError(null);

    if (isLocked) {
      setFormError(
        'La nota ya tiene aplicaciones o está cerrada. Debe reversarse antes de modificarla.',
      );
      return;
    }

    if (isSubmitting) {
      return;
    }

    // Protección adicional al momento de guardar.
    if (fecha > hoyGuatemalaIso()) {
      setErrors({
        fecha: 'La fecha de la nota de crédito no puede ser futura.',
      });
      return;
    }

    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const payload = {
      idCliente: Number(idCliente),
      idDocumentoReferencia: idDocumentoReferencia
        ? Number(idDocumentoReferencia)
        : null,
      descripcion: descripcion.trim() || null,
      serie: serie.trim().toUpperCase() || null,
      numero: numero.trim().toUpperCase() || null,
      fecha,
      monto: Number(monto),
    };

    try {
      if (isEditing) {
        await apiClient.patch(
          `/cxc/notas-credito/${nota!.idNotaCredito}`,
          payload,
        );
      } else {
        await apiClient.post('/cxc/notas-credito', payload);
      }

      onSuccess();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        Array.isArray(err.details)
      ) {
        const fieldErrors: ValidationErrors = {};

        (
          err.details as Array<{
            campo: string;
            mensaje: string;
          }>
        ).forEach((detalle) => {
          fieldErrors[detalle.campo] = detalle.mensaje;
        });

        setErrors(fieldErrors);
      } else {
        setFormError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo guardar la nota de crédito',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================================
  // FORMULARIO
  // =====================================================

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        La nota de crédito no reduce el saldo al registrarse.
        El efecto financiero ocurre únicamente cuando se aplica
        a un documento.
      </div>

      {isEditing && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">
              Estado:
            </span>

            <StatusBadge status={nota?.estado} />

            <span className="ml-auto text-slate-600">
              Aplicado:{' '}
              <strong>
                Q {Number(nota?.montoAplicado ?? 0).toFixed(2)}
              </strong>
              {' '}· Disponible:{' '}
              <strong>
                Q {Number(
                  nota?.montoDisponible ?? nota?.monto ?? 0,
                ).toFixed(2)}
              </strong>
            </span>
          </div>
        </div>
      )}

      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta nota ya tiene aplicaciones o está cerrada.
          Su cabecera queda bloqueada para proteger la trazabilidad.
        </div>
      )}

      <SearchableSelect
        label="Cliente"
        required
        value={idCliente}
        onChange={(e: any) =>
          handleClienteChange(e.target.value)
        }
        options={clientes.map((cliente) => ({
          value: cliente.id,
          label: cliente.label,
        }))}
        error={errors.idCliente}
        placeholder="Seleccionar cliente"
        helperText="Cliente al que pertenece la nota de crédito."
        isReadOnly={isLocked}
      />

      <Select
        label="Documento de referencia"
        value={idDocumentoReferencia}
        onChange={(e: any) =>
          setIdDocumentoReferencia(e.target.value)
        }
        options={documentos.map((documento) => ({
          value: documento.id,
          label: documento.label,
        }))}
        placeholder={
          idCliente
            ? 'Seleccionar documento (opcional)'
            : 'Selecciona un cliente primero'
        }
        isReadOnly={!idCliente || isLocked}
        error={errors.idDocumentoReferencia}
        helperText="Opcional; solo se muestran documentos con saldo pendiente del cliente."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Serie"
          restriction="identifier"
          uppercase
          maxLength={30}
          value={serie}
          onChange={(e: any) =>
            setSerie(e.target.value)
          }
          error={errors.serie}
          placeholder="Ej. NC"
          helperText="Código alfanumérico; admite -, _ y /."
          isReadOnly={isLocked}
        />

        <TextInput
          label="Número"
          restriction="identifier"
          uppercase
          maxLength={30}
          value={numero}
          onChange={(e: any) =>
            setNumero(e.target.value)
          }
          error={errors.numero}
          placeholder="Ej. 000001"
          helperText="Referencia alfanumérica de la nota; máximo 30 caracteres."
          isReadOnly={isLocked}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha"
          type="date"
          required
          max={hoy}
          value={fecha}
          onChange={(e: any) =>
            setFecha(e.target.value)
          }
          error={errors.fecha}
          helperText="Fecha real de emisión; no puede ser futura."
          isReadOnly={isLocked}
        />

        <TextInput
          label="Monto"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          step="0.01"
          min="0.01"
          required
          value={monto}
          onChange={(e: any) =>
            setMonto(e.target.value)
          }
          error={errors.monto}
          placeholder="0.00"
          helperText={
            selectedDocumento?.saldo !== undefined
              ? `Máximo según saldo del documento: Q ${Number(
                  selectedDocumento.saldo,
                ).toFixed(2)}.`
              : 'Monto positivo con máximo 2 decimales.'
          }
          isReadOnly={isLocked}
        />
      </div>

      <TextArea
        label="Descripción"
        maxLength={250}
        helperText="Motivo o detalle de la nota de crédito (máx. 250 caracteres)."
        value={descripcion}
        onChange={(e: any) =>
          setDescripcion(e.target.value)
        }
        rows={3}
        error={errors.descripcion}
        placeholder="Motivo de la nota de crédito"
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
        createLabel="Crear nota de crédito"
        isFormValid={isFormValid}
        blockers={validationErrors}
        lockedReason={
          isLocked
            ? 'La nota de crédito ya tiene aplicaciones o está cerrada; debe reversarse antes de modificarla.'
            : undefined
        }
      />
    </form>
  );
};
