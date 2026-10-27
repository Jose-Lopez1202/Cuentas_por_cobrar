
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

import type {
  AplicacionPago,
  CatalogoOption,
  Pago,
} from '@erp/contracts';

export function AplicacionPagoForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: AplicacionPago | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);

  const [pagos, setPagos] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);

  const [idPago, setIdPago] = useState(
    item?.idPago?.toString() ?? '',
  );

  const [idDocumento, setIdDocumento] = useState(
    item?.idDocumento?.toString() ?? '',
  );

  const [fechaAplicacion, setFecha] = useState(
    item?.fechaAplicacion?.slice(0, 10) ?? todayIso(),
  );

  const [montoAplicado, setMonto] = useState(
    item?.montoAplicado?.toString() ?? '',
  );

  const [fechaPagoOriginal, setFechaPagoOriginal] = useState('');
  const [cargandoFechaPago, setCargandoFechaPago] = useState(false);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // =====================================================
  // CARGAR PAGOS DISPONIBLES
  // =====================================================

  useEffect(() => {
    apiClient
      .get<CatalogoOption[]>('/cxc/catalogos/pagos')
      .then(setPagos)
      .catch(() => setPagos([]));
  }, []);

  const pagoSeleccionado = pagos.find(
    (p) => String(p.id) === idPago,
  );

  const idClientePago = pagoSeleccionado?.idCliente;

  // =====================================================
  // CONSULTAR FECHA REAL DEL PAGO
  // =====================================================

  useEffect(() => {
    if (!idPago) {
      setFechaPagoOriginal('');
      setCargandoFechaPago(false);
      return;
    }

    let activo = true;

    setFechaPagoOriginal('');
    setCargandoFechaPago(true);

    apiClient
      .get<Pick<Pago, 'fechaPago'>>(`/cxc/pagos/${idPago}`)
      .then((data) => {
        if (!activo) return;

        const fecha = data.fechaPago?.slice(0, 10) ?? '';

        setFechaPagoOriginal(fecha);

        if (!fecha) {
          setFormError(
            'El pago seleccionado no tiene una fecha válida.',
          );
        }
      })
      .catch(() => {
        if (!activo) return;

        setFechaPagoOriginal('');
        setFormError(
          'No se pudo consultar la fecha del pago seleccionado.',
        );
      })
      .finally(() => {
        if (activo) {
          setCargandoFechaPago(false);
        }
      });

    return () => {
      activo = false;
    };
  }, [idPago]);

  // =====================================================
  // CARGAR DOCUMENTOS DEL CLIENTE
  // =====================================================

  useEffect(() => {
    if (!idClientePago) {
      setDocumentos([]);
      return;
    }

    let activo = true;

    apiClient
      .get<CatalogoOption[]>(
        `/cxc/catalogos/clientes/${idClientePago}/documentos-pendientes`,
      )
      .then((data) => {
        if (!activo) return;

        setDocumentos(data);

        setIdDocumento((actual) =>
          data.some((doc) => String(doc.id) === actual)
            ? actual
            : '',
        );
      })
      .catch(() => {
        if (!activo) return;

        setDocumentos([]);
        setIdDocumento('');
      });

    return () => {
      activo = false;
    };
  }, [idClientePago]);

  const documentoSeleccionado = documentos.find(
    (d) => String(d.id) === idDocumento,
  );

  // =====================================================
  // CALCULAR MONTO MÁXIMO APLICABLE
  // =====================================================

  const maxAplicable = Math.min(
    pagoSeleccionado?.saldo ?? Number.POSITIVE_INFINITY,
    documentoSeleccionado?.saldo ?? Number.POSITIVE_INFINITY,
  );

  // =====================================================
  // VALIDACIONES DEL FORMULARIO
  // =====================================================

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};

    const pagoErr = validateRequiredSelect(
      idPago,
      'un pago',
    );

    if (pagoErr) {
      next.idPago = pagoErr;
    }

    const documentoErr = validateRequiredSelect(
      idDocumento,
      'un documento pendiente del cliente',
    );

    if (documentoErr) {
      next.idDocumento = documentoErr;
    }

    // La fecha de aplicación debe estar entre
    // la fecha original del pago y la fecha actual.

    const fechaErr = validateRequiredDate(
      fechaAplicacion,
      'La fecha de aplicación',
      {
        notFuture: true,
        maxDate: todayIso(),
        notBefore: fechaPagoOriginal
          ? {
              date: fechaPagoOriginal,
              label: 'la fecha del pago',
            }
          : undefined,
      },
    );

    if (fechaErr) {
      next.fechaAplicacion = fechaErr;
    }

    // No permitir registrar aplicaciones si todavía
    // no conocemos la fecha del pago original.

    if (idPago && !fechaPagoOriginal) {
      next.fechaAplicacion = cargandoFechaPago
        ? 'Consultando la fecha del pago.'
        : 'No se pudo verificar la fecha del pago.';
    }

    // Comprobar que el monto sea válido.

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
      next.montoAplicado =
        `El monto no puede superar Q ${maxAplicable.toFixed(2)}, ` +
        'según el disponible del pago y el saldo del documento.';
    }

    return next;
  }, [
    idPago,
    idDocumento,
    fechaAplicacion,
    montoAplicado,
    maxAplicable,
    fechaPagoOriginal,
    cargandoFechaPago,
  ]);

  const isFormValid =
    !hasErrors(validationErrors) &&
    !busy &&
    !cargandoFechaPago;

  const errorFor = (field: string, value = '') =>
    errors[field] ??
    (value ? validationErrors[field] : undefined);

  // =====================================================
  // CAMBIAR PAGO SELECCIONADO
  // =====================================================

  const handlePagoChange = (value: string) => {
    setIdPago(value);
    setIdDocumento('');
    setFechaPagoOriginal('');
    setFormError(null);
    setErrors({});
  };

  // =====================================================
  // GUARDAR APLICACIÓN DEL PAGO
  // =====================================================

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (busy || cargandoFechaPago) {
      return;
    }

    // Comprobar nuevamente la fecha antes de enviar.
    // Esto también protege si el formulario permanece
    // abierto durante un cambio de día.

    const hoy = todayIso();

    if (fechaAplicacion > hoy) {
      setErrors({
        fechaAplicacion:
          'La fecha de aplicación no puede ser futura.',
      });
      return;
    }

    if (!fechaPagoOriginal) {
      setErrors({
        fechaAplicacion:
          'Primero debe verificarse la fecha del pago.',
      });
      return;
    }

    if (fechaAplicacion < fechaPagoOriginal) {
      setErrors({
        fechaAplicacion:
          'La fecha de aplicación no puede ser anterior a la fecha del pago.',
      });
      return;
    }

    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setBusy(true);
    setErrors({});

    const payload = {
      idPago: Number(idPago),
      idDocumento: Number(idDocumento),
      fechaAplicacion,
      montoAplicado: Number(montoAplicado),
    };

    try {
      if (isEditing) {
        await apiClient.patch(
          `/cxc/aplicaciones-pago/${item!.idAplicacion}`,
          payload,
        );
      } else {
        await apiClient.post(
          '/cxc/aplicaciones-pago',
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
        ).forEach((d) => {
          fieldErrors[d.campo] = d.mensaje;
        });

        setErrors(fieldErrors);
      } else {
        setFormError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo guardar la aplicación',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // =====================================================
  // FORMULARIO
  // =====================================================

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4"
      noValidate
    >
      <Select
        label="Pago"
        required
        value={idPago}
        onChange={(e: any) =>
          handlePagoChange(e.target.value)
        }
        options={pagos.map((x) => ({
          value: x.id,
          label: x.label,
        }))}
        helperText="El pago determina el cliente y limita los documentos que pueden seleccionarse."
        error={errorFor('idPago')}
      />

      <Select
        label="Documento"
        required
        value={idDocumento}
        onChange={(e: any) =>
          setIdDocumento(e.target.value)
        }
        options={documentos.map((x) => ({
          value: x.id,
          label: x.label,
        }))}
        isReadOnly={!idClientePago}
        placeholder={
          idClientePago
            ? 'Seleccionar documento pendiente'
            : 'Selecciona un pago primero'
        }
        helperText="Solo se muestran documentos con saldo pendiente del mismo cliente del pago."
        error={errorFor('idDocumento')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha de aplicación"
          type="date"
          required
          min={fechaPagoOriginal || undefined}
          max={todayIso()}
          value={fechaAplicacion}
          onChange={(e: any) =>
            setFecha(e.target.value)
          }
          helperText={
            fechaPagoOriginal
              ? `Debe ser igual o posterior al pago (${fechaPagoOriginal}) y no puede ser futura.`
              : 'Selecciona un pago para verificar la fecha mínima de aplicación.'
          }
          error={errorFor(
            'fechaAplicacion',
            fechaAplicacion,
          )}
          isReadOnly={
            cargandoFechaPago || !fechaPagoOriginal
          }
        />

        <TextInput
          label="Monto aplicado"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          max={
            Number.isFinite(maxAplicable)
              ? maxAplicable
              : undefined
          }
          step="0.01"
          required
          value={montoAplicado}
          onChange={(e: any) =>
            setMonto(e.target.value)
          }
          helperText={
            Number.isFinite(maxAplicable)
              ? `Máximo aplicable: Q ${maxAplicable.toFixed(2)} (menor entre disponible del pago y saldo del documento).`
              : 'Mayor a 0, máximo 2 decimales.'
          }
          error={errorFor(
            'montoAplicado',
            montoAplicado,
          )}
        />
      </div>

      {formError && (
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={busy}
        isEditing={isEditing}
        isFormValid={isFormValid}
        blockers={validationErrors}
        createLabel="Guardar aplicación"
      />
    </form>
  );
}
