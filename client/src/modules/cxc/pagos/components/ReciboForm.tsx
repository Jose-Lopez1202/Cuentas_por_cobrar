
import React, { useEffect, useMemo, useState } from 'react';

import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import { SearchableSelect } from '../../../../shared/components/SearchableSelect';

import {
  hasErrors,
  validateIdentifier,
  validateMoney,
  validateRequiredDate,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';

import type {
  Recibo,
  CatalogoOption,
  Pago,
} from '@erp/contracts';

const ESTADOS_RECIBO = ['EMITIDO', 'CANCELADO'] as const;

// Fecha de negocio en Guatemala, formato YYYY-MM-DD.
function hoyGuatemalaIso(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function ReciboForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: Recibo | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);

  const isReciboEmitido =
    isEditing &&
    String(item?.estado ?? '').trim().toUpperCase() === 'EMITIDO';

  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [pagos, setPagos] = useState<CatalogoOption[]>([]);

  const [idCliente, setCliente] = useState(
    item?.idCliente?.toString() ?? '',
  );

  const [idPago, setPago] = useState(
    item?.idPago?.toString() ?? '',
  );

  const [numeroRecibo, setNumero] = useState(
    item?.numeroRecibo ?? '',
  );

  const [fecha, setFecha] = useState(
    item?.fecha?.slice(0, 10) ?? hoyGuatemalaIso(),
  );

  const [monto, setMonto] = useState(
    item?.monto?.toString() ?? '',
  );

  const [estado, setEstado] = useState<Recibo['estado']>(
    item?.estado ?? 'EMITIDO',
  );

  const [fechaPagoOriginal, setFechaPagoOriginal] = useState('');
  const [cargandoPago, setCargandoPago] = useState(false);
  const [pagoConsultado, setPagoConsultado] = useState<Pago | null>(null);
  const [pagoVerificadoId, setPagoVerificadoId] = useState('');

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  // CARGAR PAGOS DEL CLIENTE
  // =====================================================

  useEffect(() => {
    if (!idCliente) {
      setPagos([]);
      return;
    }

    let activo = true;

    setPagos([]);

    apiClient
      .get<CatalogoOption[]>(
        `/cxc/catalogos/pagos?idCliente=${encodeURIComponent(idCliente)}`,
      )
      .then((data) => {
        if (activo) setPagos(data);
      })
      .catch(() => {
        if (activo) setPagos([]);
      });

    return () => {
      activo = false;
    };
  }, [idCliente]);

  const pagoSeleccionado = pagos.find(
    (p) => String(p.id) === idPago,
  );

  // =====================================================
  // CONSULTAR INFORMACIÓN REAL DEL PAGO
  // =====================================================

  useEffect(() => {
    if (!idPago) {
      setFechaPagoOriginal('');
      setPagoConsultado(null);
      setPagoVerificadoId('');
      setCargandoPago(false);
      return;
    }

    let activo = true;

    setFechaPagoOriginal('');
    setPagoConsultado(null);
    setPagoVerificadoId('');
    setCargandoPago(true);

    apiClient
      .get<Pago>(`/cxc/pagos/${encodeURIComponent(idPago)}`)
      .then((data) => {
        if (!activo) return;

        setPagoConsultado(data);
        setFechaPagoOriginal(data.fechaPago?.slice(0, 10) ?? '');
        setPagoVerificadoId(idPago);
      })
      .catch(() => {
        if (!activo) return;

        setPagoConsultado(null);
        setFechaPagoOriginal('');
        setPagoVerificadoId('');
        setFormError(
          'No se pudo consultar la información del pago seleccionado.',
        );
      })
      .finally(() => {
        if (activo) setCargandoPago(false);
      });

    return () => {
      activo = false;
    };
  }, [idPago]);

  const pagoVerificado =
    pagoVerificadoId === idPago ? pagoConsultado : null;

  const fechaPagoVerificada =
    pagoVerificado ? fechaPagoOriginal : '';

  const montoMaximo =
    pagoVerificado?.monto ?? pagoSeleccionado?.monto;

  // =====================================================
  // VALIDACIONES
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

    const pagoErr = validateRequiredSelect(
      idPago,
      'un pago del cliente',
    );

    if (pagoErr) {
      next.idPago = pagoErr;
    }

    if (numeroRecibo) {
      const numeroErr = validateIdentifier(
        numeroRecibo,
        'El número de recibo',
      );

      if (numeroErr) {
        next.numeroRecibo = numeroErr;
      }
    }

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
    } else if (
      fechaPagoVerificada &&
      fecha < fechaPagoVerificada
    ) {
      next.fecha =
        'La fecha del recibo no puede ser anterior a la fecha del pago.';
    }

    if (idPago && !fechaPagoVerificada) {
      next.fecha = cargandoPago
        ? 'Consultando la fecha del pago.'
        : 'No se pudo verificar la fecha del pago.';
    }

    if (
      pagoVerificado &&
      Number(pagoVerificado.idCliente) !== Number(idCliente)
    ) {
      next.idPago =
        'El pago seleccionado no pertenece al cliente indicado.';
    }

    const estadoPago = String(
      pagoVerificado?.estado ?? '',
    ).trim().toUpperCase();

    if (['ANULADO', 'REVERSADO'].includes(estadoPago)) {
      next.idPago =
        'No se pueden emitir recibos para pagos anulados o reversados.';
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
    } else if (
      montoMaximo !== undefined &&
      Number(monto) > Number(montoMaximo)
    ) {
      next.monto =
        `El monto del recibo no puede superar el pago seleccionado ` +
        `(${Number(montoMaximo).toFixed(2)}).`;
    }

    if (
      !isEditing &&
      estado !== 'EMITIDO'
    ) {
      next.estado =
        'Los recibos nuevos deben registrarse como emitidos.';
    }

    return next;
  }, [
    idCliente,
    idPago,
    numeroRecibo,
    fecha,
    monto,
    estado,
    hoy,
    fechaPagoVerificada,
    cargandoPago,
    pagoVerificado,
    montoMaximo,
    isEditing,
  ]);

  const isFormValid =
    !hasErrors(validationErrors) &&
    !busy &&
    !cargandoPago &&
    !isReciboEmitido;

  const errorFor = (field: string, value = '') =>
    errors[field] ??
    (value ? validationErrors[field] : undefined);

  // =====================================================
  // CAMBIO DE CLIENTE Y PAGO
  // =====================================================

  const handleClienteChange = (value: string) => {
    setCliente(value);
    setPago('');
    setPagos([]);
    setFechaPagoOriginal('');
    setPagoConsultado(null);
    setPagoVerificadoId('');
    setErrors({});
    setFormError(null);
  };

  const handlePagoChange = (value: string) => {
    setPago(value);
    setFechaPagoOriginal('');
    setPagoConsultado(null);
    setPagoVerificadoId('');
    setErrors({});
    setFormError(null);
  };

  // =====================================================
  // GUARDAR RECIBO
  // =====================================================

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isReciboEmitido) {
      setFormError(
        'Este recibo ya fue emitido y no puede modificarse directamente.',
      );
      return;
    }

    if (busy || cargandoPago) {
      return;
    }

    if (!pagoVerificado || !fechaPagoVerificada) {
      setErrors({
        fecha: 'Primero debe verificarse la fecha del pago.',
      });
      return;
    }

    // Validación adicional justo antes de guardar.
    const hoyActual = hoyGuatemalaIso();

    if (fecha > hoyActual) {
      setErrors({
        fecha: 'La fecha del recibo no puede ser futura.',
      });
      return;
    }

    if (fecha < fechaPagoVerificada) {
      setErrors({
        fecha:
          'La fecha del recibo no puede ser anterior a la fecha del pago.',
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
      idCliente: Number(idCliente),
      idPago: Number(idPago),
      numeroRecibo: numeroRecibo.trim() || undefined,
      fecha,
      monto: Number(monto),
      estado: isEditing ? estado : 'EMITIDO',
    };

    try {
      if (isEditing) {
        await apiClient.patch(
          `/cxc/recibos/${item!.idRecibo}`,
          payload,
        );
      } else {
        await apiClient.post('/cxc/recibos', payload);
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
            : 'No se pudo guardar el recibo',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  // =====================================================
  // INTERFAZ DEL FORMULARIO
  // =====================================================

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4"
      noValidate
    >
      {isReciboEmitido && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Este recibo ya fue emitido. Sus datos financieros
          no pueden modificarse directamente.
        </p>
      )}

      <SearchableSelect
        label="Cliente"
        required
        value={idCliente}
        onChange={(e: any) =>
          handleClienteChange(e.target.value)
        }
        options={clientes.map((x) => ({
          value: x.id,
          label: x.label,
        }))}
        isReadOnly={isReciboEmitido}
        helperText="Selecciona el cliente al que pertenece el recibo."
        error={errorFor('idCliente')}
      />

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
        isReadOnly={!idCliente || isReciboEmitido}
        placeholder={
          idCliente
            ? 'Seleccionar pago'
            : 'Selecciona un cliente primero'
        }
        helperText="Solo se muestran pagos del cliente seleccionado."
        error={errorFor('idPago')}
      />

      <TextInput
        label="Número de recibo"
        restriction="identifier"
        uppercase
        maxLength={30}
        value={numeroRecibo}
        onChange={(e: any) =>
          setNumero(e.target.value)
        }
        isReadOnly={isReciboEmitido}
        helperText="Correlativo del recibo; admite letras, números, -, _ y /."
        error={errorFor('numeroRecibo', numeroRecibo)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha"
          type="date"
          required
          min={fechaPagoVerificada || undefined}
          max={hoy}
          value={fecha}
          onChange={(e: any) =>
            setFecha(e.target.value)
          }
          isReadOnly={
            isReciboEmitido ||
            cargandoPago ||
            !fechaPagoVerificada
          }
          helperText={
            fechaPagoVerificada
              ? `Fecha igual o posterior al pago (${fechaPagoVerificada}) y no futura.`
              : 'Selecciona un pago para verificar la fecha mínima.'
          }
          error={errorFor('fecha', fecha)}
        />

        <TextInput
          label="Monto"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          max={
            montoMaximo !== undefined
              ? Number(montoMaximo)
              : undefined
          }
          step="0.01"
          required
          value={monto}
          onChange={(e: any) =>
            setMonto(e.target.value)
          }
          isReadOnly={isReciboEmitido}
          helperText="Mayor a 0 y no puede superar el monto del pago seleccionado."
          error={errorFor('monto', monto)}
        />
      </div>

      <Select
        label="Estado"
        required
        value={estado}
        onChange={(e: any) =>
          setEstado(e.target.value as Recibo['estado'])
        }
        options={ESTADOS_RECIBO.map((value) => ({
          value,
          label:
            value.charAt(0) +
            value.slice(1).toLowerCase(),
        }))}
        isReadOnly={!isEditing || isReciboEmitido}
        helperText={
          isEditing
            ? 'El estado del recibo está sujeto a las reglas del servidor.'
            : 'Los recibos nuevos se registran como emitidos.'
        }
        error={errorFor('estado', estado)}
      />

      {formError && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={busy}
        isEditing={isEditing}
        isFormValid={isFormValid}
        blockers={validationErrors}
        createLabel="Guardar recibo"
      />
    </form>
  );
}
