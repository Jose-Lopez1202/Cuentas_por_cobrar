
import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';

import {
  hasErrors,
  validateMoney,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';

import type {
  AplicacionNotaCredito,
  CatalogoOption,
  NotaCredito,
} from '@erp/contracts';

interface AplicacionNotaCreditoFormProps {
  aplicacion?: AplicacionNotaCredito | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// =====================================================
// FECHA ACTUAL DE GUATEMALA
// =====================================================

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

// =====================================================
// FORMULARIO
// =====================================================

export const AplicacionNotaCreditoForm = ({
  aplicacion,
  onSuccess,
  onCancel,
}: AplicacionNotaCreditoFormProps) => {
  const isEditing = Boolean(aplicacion);

  const [notasCredito, setNotasCredito] =
    useState<CatalogoOption[]>([]);

  const [documentos, setDocumentos] =
    useState<CatalogoOption[]>([]);

  const [notaSeleccionada, setNotaSeleccionada] =
    useState<NotaCredito | null>(null);

  const [idNotaCredito, setIdNotaCredito] = useState(
    aplicacion?.idNotaCredito?.toString() ?? '',
  );

  const [idDocumento, setIdDocumento] = useState(
    aplicacion?.idDocumento?.toString() ?? '',
  );

  const [montoAplicado, setMontoAplicado] = useState(
    aplicacion?.montoAplicado?.toString() ?? '',
  );

  const [fechaAplicacion, setFechaAplicacion] = useState(
    () =>
      aplicacion?.fechaAplicacion?.slice(0, 10) ??
      hoyGuatemalaIso(),
  );

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [cargandoNota, setCargandoNota] = useState(false);
  const [notaVerificadaId, setNotaVerificadaId] = useState('');
  const [documentosCargados, setDocumentosCargados] =
    useState(false);

  const [formError, setFormError] = useState<string | null>(
    null,
  );

  const hoy = hoyGuatemalaIso();

  // =====================================================
  // CARGAR CATÁLOGO DE NOTAS DE CRÉDITO
  // =====================================================

  useEffect(() => {
    let activo = true;

    apiClient
      .get<CatalogoOption[]>('/cxc/catalogos/notas-credito')
      .then((data) => {
        if (activo) setNotasCredito(data);
      })
      .catch(() => {
        if (activo) setNotasCredito([]);
      });

    return () => {
      activo = false;
    };
  }, []);

  // =====================================================
  // CARGAR NOTA SELECCIONADA Y SUS DOCUMENTOS
  // =====================================================

  useEffect(() => {
    if (!idNotaCredito) {
      setNotaSeleccionada(null);
      setNotaVerificadaId('');
      setDocumentos([]);
      setDocumentosCargados(false);
      setCargandoNota(false);
      return;
    }

    let activo = true;

    setNotaSeleccionada(null);
    setNotaVerificadaId('');
    setDocumentos([]);
    setDocumentosCargados(false);
    setCargandoNota(true);

    const cargarDatos = async () => {
      try {
        const nota = await apiClient.get<NotaCredito>(
          `/cxc/notas-credito/${encodeURIComponent(
            idNotaCredito,
          )}`,
        );

        if (!activo) return;

        // Mantener los datos asociados exclusivamente
        // a la nota que continúa seleccionada.
        setNotaSeleccionada(nota);
        setNotaVerificadaId(idNotaCredito);

        const docs = await apiClient.get<CatalogoOption[]>(
          `/cxc/catalogos/clientes/${encodeURIComponent(
            String(nota.idCliente),
          )}/documentos-pendientes`,
        );

        if (!activo) return;

        setDocumentos(docs);
        setDocumentosCargados(true);
      } catch {
        if (!activo) return;

        setNotaSeleccionada(null);
        setNotaVerificadaId('');
        setDocumentos([]);
        setDocumentosCargados(false);

        setFormError(
          'No se pudo consultar la nota de crédito o sus documentos.',
        );
      } finally {
        if (activo) {
          setCargandoNota(false);
        }
      }
    };

    void cargarDatos();

    return () => {
      activo = false;
    };
  }, [idNotaCredito]);

  // Solo usar información de la nota que está
  // seleccionada actualmente.
  const notaVerificada =
    idNotaCredito &&
    notaVerificadaId === idNotaCredito
      ? notaSeleccionada
      : null;

  // =====================================================
  // DATOS DEL DOCUMENTO Y FECHA MÍNIMA
  // =====================================================

  const selectedDocumento = useMemo(
    () =>
      documentos.find(
        (documento) =>
          String(documento.id) === idDocumento,
      ),
    [documentos, idDocumento],
  );

  const fechaNota = notaVerificada?.fecha?.slice(0, 10) ?? '';

  const maxAplicable = Math.min(
    notaVerificada?.montoDisponible ??
      Number.POSITIVE_INFINITY,
    selectedDocumento?.saldo ??
      Number.POSITIVE_INFINITY,
  );

  // =====================================================
  // VALIDACIONES
  // =====================================================

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const notaErr = validateRequiredSelect(
      idNotaCredito,
      'una nota de crédito',
    );

    if (notaErr) {
      next.idNotaCredito = notaErr;
    }

    if (idNotaCredito) {
      if (!notaVerificada || !documentosCargados) {
        next.idNotaCredito = cargandoNota
          ? 'Consultando la nota de crédito.'
          : 'No se pudo verificar la nota de crédito.';
      } else {
        const estadoNota = String(
          notaVerificada.estado ?? '',
        ).trim().toUpperCase();

        // En creación únicamente se permiten
        // notas pendientes o activas.
        if (
          !isEditing &&
          !['PENDIENTE', 'ACTIVA'].includes(estadoNota)
        ) {
          next.idNotaCredito =
            'La nota de crédito seleccionada no está disponible para aplicar.';
        }
      }
    }

    const documentoErr = validateRequiredSelect(
      idDocumento,
      'un documento',
    );

    if (documentoErr) {
      next.idDocumento = documentoErr;
    } else if (
      documentosCargados &&
      !selectedDocumento &&
      !isEditing
    ) {
      next.idDocumento =
        'El documento seleccionado no está disponible para esta nota de crédito.';
    }

    const montoErr = validateMoney(
      montoAplicado,
      'El monto aplicado',
      {
        required: true,
        positive: true,
      },
    );

    if (montoErr) {
      next.montoAplicado = montoErr;
    } else if (
      Number.isFinite(maxAplicable) &&
      Number(montoAplicado) > maxAplicable
    ) {
      // Para una aplicación existente, el monto
      // disponible actual puede ser menor por
      // aplicaciones anteriores. El backend es
      // responsable de verificar la edición.
      if (!isEditing) {
        next.montoAplicado =
          `El monto aplicado no puede superar ` +
          `${maxAplicable.toFixed(2)}.`;
      }
    }

    const fechaErr = validateRequiredDate(
      fechaAplicacion,
      'La fecha de aplicación',
      {
        notFuture: true,
        maxDate: hoy,
      },
    );

    if (fechaErr) {
      next.fechaAplicacion = fechaErr;
    } else if (
      fechaNota &&
      fechaAplicacion < fechaNota
    ) {
      next.fechaAplicacion =
        'La fecha de aplicación no puede ser anterior a la emisión de la nota de crédito.';
    }

    return next;
  }, [
    idNotaCredito,
    idDocumento,
    montoAplicado,
    fechaAplicacion,
    notaVerificada,
    documentosCargados,
    cargandoNota,
    selectedDocumento,
    maxAplicable,
    fechaNota,
    isEditing,
    hoy,
  ]);

  const isFormValid =
    !hasErrors(validationErrors) &&
    !isSubmitting &&
    !cargandoNota;

  // =====================================================
  // CAMBIO DE NOTA DE CRÉDITO
  // =====================================================

  const handleNotaChange = (value: string) => {
    setIdNotaCredito(value);
    setIdDocumento('');
    setNotaSeleccionada(null);
    setNotaVerificadaId('');
    setDocumentos([]);
    setDocumentosCargados(false);
    setErrors({});
    setFormError(null);
  };

  // =====================================================
  // GUARDAR APLICACIÓN
  // =====================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isSubmitting || cargandoNota) {
      return;
    }

    const validacion = validationErrors;

    if (fechaAplicacion > hoyGuatemalaIso()) {
      setErrors({
        fechaAplicacion:
          'La fecha de aplicación no puede ser futura.',
      });
      return;
    }

    if (
      fechaNota &&
      fechaAplicacion < fechaNota
    ) {
      setErrors({
        fechaAplicacion:
          'La fecha de aplicación no puede ser anterior a la emisión de la nota de crédito.',
      });
      return;
    }

    if (hasErrors(validacion)) {
      setErrors(validacion);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const payload = {
      idNotaCredito: Number(idNotaCredito),
      idDocumento: Number(idDocumento),
      montoAplicado: Number(montoAplicado),
      fechaAplicacion,
    };

    try {
      if (isEditing) {
        await apiClient.patch(
          `/cxc/aplicaciones-nota-credito/${aplicacion!.idAplicacionNc}`,
          payload,
        );
      } else {
        await apiClient.post(
          '/cxc/aplicaciones-nota-credito',
          payload,
        );
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
            : 'No se pudo guardar la aplicación de nota de crédito',
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
      <Select
        label="Nota de Crédito"
        required
        value={idNotaCredito}
        onChange={(e: any) =>
          handleNotaChange(e.target.value)
        }
        options={notasCredito.map((nota) => ({
          value: nota.id,
          label: nota.label,
        }))}
        placeholder="Seleccionar nota de crédito"
        error={errors.idNotaCredito}
        helperText="Solo aparecen notas de crédito pendientes con saldo disponible."
      />

      <Select
        label="Documento"
        required
        value={idDocumento}
        onChange={(e: any) => {
          setIdDocumento(e.target.value);
          setErrors({});
        }}
        options={documentos.map((documento) => ({
          value: documento.id,
          label: documento.label,
        }))}
        placeholder={
          idNotaCredito
            ? 'Seleccionar documento'
            : 'Selecciona una nota de crédito primero'
        }
        isReadOnly={
          !idNotaCredito ||
          !notaVerificada ||
          !documentosCargados
        }
        error={errors.idDocumento}
        helperText="Solo aparecen documentos pendientes del mismo cliente de la nota."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Monto aplicado"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          step="0.01"
          min="0.01"
          max={
            Number.isFinite(maxAplicable) && !isEditing
              ? String(maxAplicable)
              : undefined
          }
          required
          value={montoAplicado}
          onChange={(e: any) =>
            setMontoAplicado(e.target.value)
          }
          error={
            errors.montoAplicado ??
            (montoAplicado
              ? validationErrors.montoAplicado
              : undefined)
          }
          placeholder="0.00"
          helperText={
            Number.isFinite(maxAplicable) && !isEditing
              ? `No puede superar ${maxAplicable.toFixed(2)}, según nota y saldo del documento.`
              : 'Monto positivo, máximo 2 decimales.'
          }
        />

        <TextInput
          label="Fecha de aplicación"
          type="date"
          required
          min={fechaNota || undefined}
          max={hoy}
          value={fechaAplicacion}
          onChange={(e: any) =>
            setFechaAplicacion(e.target.value)
          }
          error={
            errors.fechaAplicacion ??
            (fechaAplicacion
              ? validationErrors.fechaAplicacion
              : undefined)
          }
          helperText={
            fechaNota
              ? `Fecha igual o posterior a la emisión (${fechaNota}) y no futura.`
              : 'Fecha real de la aplicación; no puede ser futura.'
          }
          isReadOnly={
            Boolean(idNotaCredito) &&
            (!notaVerificada || cargandoNota)
          }
        />
      </div>

      {formError && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        createLabel="Crear aplicación"
        isFormValid={isFormValid}
        blockers={validationErrors}
      />
    </form>
  );
};
