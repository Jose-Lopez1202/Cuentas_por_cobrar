
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
import type { Anticipo, CatalogoOption, Pago } from '@erp/contracts';
import { SearchableSelect } from '../../../../shared/components/SearchableSelect';
import { CampoUsuarioActual } from '../../../../shared/components/CampoUsuarioActual';

// Fecha de negocio de Guatemala.
function hoyGuatemalaIso(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obtener = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
}

export function AnticipoForm({
  item,
  onSuccess,
  onCancel,
}: {
  item?: Anticipo | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);

  const isLocked =
    isEditing &&
    String(item?.estado ?? '').trim().toUpperCase() !== 'DISPONIBLE';

  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [pagos, setPagos] = useState<CatalogoOption[]>([]);

  const [idCliente, setCliente] = useState(
    item?.idCliente?.toString() ?? '',
  );

  const [idPago, setPago] = useState(
    item?.idPago?.toString() ?? '',
  );

  const [montoOriginal, setOriginal] = useState(
    item?.montoOriginal?.toString() ?? '',
  );

  const [montoDisponible, setDisponible] = useState(
    item?.montoDisponible?.toString() ?? '',
  );

  const [fecha, setFecha] = useState(
    item?.fecha?.slice(0, 10) ?? hoyGuatemalaIso(),
  );

  const [pagoConsultado, setPagoConsultado] = useState<Pago | null>(null);
  const [pagoVerificadoId, setPagoVerificadoId] = useState('');
  const [cargandoPago, setCargandoPago] = useState(false);

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

  // =====================================================
  // CONSULTAR PAGO RELACIONADO
  // =====================================================

  useEffect(() => {
    if (!idPago) {
      setPagoConsultado(null);
      setPagoVerificadoId('');
      setCargandoPago(false);
      return;
    }

    let activo = true;

    setPagoConsultado(null);
    setPagoVerificadoId('');
    setCargandoPago(true);

    apiClient
      .get<Pago>(`/cxc/pagos/${encodeURIComponent(idPago)}`)
      .then((data) => {
        if (!activo) return;

        setPagoConsultado(data);
        setPagoVerificadoId(idPago);
      })
      .catch(() => {
        if (!activo) return;

        setPagoConsultado(null);
        setPagoVerificadoId('');
        setFormError(
          'No se pudo consultar la información del pago relacionado.',
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
    idPago && pagoVerificadoId === idPago
      ? pagoConsultado
      : null;

  const fechaPagoOriginal =
    pagoVerificado?.fechaPago?.slice(0, 10) ?? '';

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

    const originalErr = validateMoney(
      montoOriginal,
      'El monto original',
      {
        required: true,
        positive: true,
      },
    );

    if (originalErr) {
      next.montoOriginal = originalErr;
    }

    const disponibleErr = validateMoney(
      montoDisponible,
      'El monto disponible',
      {
        required: true,
        min: 0,
      },
    );

    if (disponibleErr) {
      next.montoDisponible = disponibleErr;
    } else if (
      montoOriginal !== '' &&
      Number(montoDisponible) > Number(montoOriginal)
    ) {
      next.montoDisponible =
        'El monto disponible no puede superar el monto original.';
    }

    // En la creación, el saldo inicial debe ser
    // exactamente igual al monto original.

    if (
      !isEditing &&
      montoOriginal !== '' &&
      montoDisponible !== '' &&
      Number(montoDisponible) !== Number(montoOriginal)
    ) {
      next.montoDisponible =
        'Al crear un anticipo, el disponible debe ser igual al monto original.';
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
      fechaPagoOriginal &&
      fecha < fechaPagoOriginal
    ) {
      next.fecha =
        'La fecha del anticipo no puede ser anterior a la fecha del pago.';
    }

    // El pago es opcional, pero debe verificarse
    // cuando se selecciona.

    if (idPago) {
      if (!pagoVerificado || !fechaPagoOriginal) {
        next.idPago = cargandoPago
          ? 'Consultando el pago relacionado.'
          : 'No se pudo verificar el pago relacionado.';
      } else {
        if (
          Number(pagoVerificado.idCliente) !== Number(idCliente)
        ) {
          next.idPago =
            'El pago seleccionado no pertenece al cliente indicado.';
        }

        const estadoPago = String(
          pagoVerificado.estado ?? '',
        ).trim().toUpperCase();

        if (['ANULADO', 'REVERSADO'].includes(estadoPago)) {
          next.idPago =
            'No se puede relacionar un anticipo con un pago anulado o reversado.';
        }
      }
    }

    return next;
  }, [
    idCliente,
    idPago,
    montoOriginal,
    montoDisponible,
    fecha,
    hoy,
    isEditing,
    pagoVerificado,
    fechaPagoOriginal,
    cargandoPago,
  ]);

  const isFormValid =
    !hasErrors(validationErrors) &&
    !isLocked &&
    !busy &&
    !cargandoPago;

  const errorFor = (field: string, value = '') =>
    errors[field] ??
    (value ? validationErrors[field] : undefined);

  // =====================================================
  // CAMBIAR CLIENTE
  // =====================================================

  const handleClienteChange = (value: string) => {
    setCliente(value);
    setPago('');
    setPagos([]);
    setPagoConsultado(null);
    setPagoVerificadoId('');
    setErrors({});
    setFormError(null);
  };

  // =====================================================
  // CAMBIAR PAGO
  // =====================================================

  const handlePagoChange = (value: string) => {
    setPago(value);
    setPagoConsultado(null);
    setPagoVerificadoId('');
    setErrors({});
    setFormError(null);
  };

  // =====================================================
  // GUARDAR ANTICIPO
  // =====================================================

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isLocked) {
      setFormError(
        'Este anticipo ya tiene aplicaciones o está anulado. Para corregirlo, utiliza el procedimiento correspondiente.',
      );
      return;
    }

    if (busy || cargandoPago) {
      return;
    }

    const hoyActual = hoyGuatemalaIso();

    if (fecha > hoyActual) {
      setErrors({
        fecha: 'La fecha del anticipo no puede ser futura.',
      });
      return;
    }

    if (idPago && !pagoVerificado) {
      setErrors({
        idPago: 'Primero debe verificarse el pago relacionado.',
      });
      return;
    }

    if (
      idPago &&
      fechaPagoOriginal &&
      fecha < fechaPagoOriginal
    ) {
      setErrors({
        fecha:
          'La fecha del anticipo no puede ser anterior a la fecha del pago.',
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
      idPago: idPago ? Number(idPago) : undefined,
      montoOriginal: Number(montoOriginal),
      montoDisponible: Number(montoDisponible),
      fecha,
    };

    try {
      if (isEditing) {
        await apiClient.patch(
          `/cxc/anticipos/${item!.idAnticipo}`,
          payload,
        );
      } else {
        await apiClient.post('/cxc/anticipos', payload);
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
            : 'No se pudo guardar el anticipo',
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
      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este anticipo ya tiene aplicaciones o está anulado;
          su cabecera queda bloqueada para proteger la trazabilidad.
        </div>
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
        helperText="Selecciona el cliente propietario del anticipo."
        error={errorFor('idCliente')}
        isReadOnly={isLocked}
      />

      <Select
        label="Pago relacionado"
        value={idPago}
        onChange={(e: any) =>
          handlePagoChange(e.target.value)
        }
        options={pagos.map((x) => ({
          value: x.id,
          label: x.label,
        }))}
        isReadOnly={!idCliente || isLocked}
        placeholder={
          idCliente
            ? 'Seleccionar pago (opcional)'
            : 'Selecciona un cliente primero'
        }
        helperText="Opcional; solo se muestran pagos del cliente seleccionado."
        error={errorFor('idPago', idPago)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Monto original"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0.01}
          step="0.01"
          required
          value={montoOriginal}
          onChange={(e: any) => {
            setOriginal(e.target.value);

            if (!isEditing) {
              setDisponible(e.target.value);
            }
          }}
          helperText="Importe inicial del anticipo; mayor a cero."
          error={errorFor('montoOriginal', montoOriginal)}
          isReadOnly={isLocked}
        />

        <TextInput
          label="Monto disponible"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          min={0}
          step="0.01"
          required
          value={montoDisponible}
          onChange={(e: any) =>
            setDisponible(e.target.value)
          }
          isReadOnly={!isEditing || isLocked}
          helperText={
            isEditing
              ? 'Debe estar entre cero y el monto original.'
              : 'Al crear inicia automáticamente igual al monto original.'
          }
          error={errorFor(
            'montoDisponible',
            montoDisponible,
          )}
        />
      </div>

      <TextInput
        label="Fecha"
        type="date"
        required
        min={fechaPagoOriginal || undefined}
        max={hoy}
        value={fecha}
        onChange={(e: any) =>
          setFecha(e.target.value)
        }
        helperText={
          fechaPagoOriginal
            ? `Debe ser igual o posterior al pago (${fechaPagoOriginal}) y no puede ser futura.`
            : 'Fecha real del anticipo; no puede ser futura.'
        }
        error={errorFor('fecha', fecha)}
        isReadOnly={
          isLocked ||
          (Boolean(idPago) && (cargandoPago || !pagoVerificado))
        }
      />

      {isEditing && (
        <TextInput
          label="Estado"
          value={item?.estado ?? ''}
          isReadOnly
          helperText="El estado lo administra el motor financiero mediante aplicaciones, reversas o anulación formal."
        />
      )}

      {!isEditing && <CampoUsuarioActual />}
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
        lockedReason={
          isLocked
            ? 'El anticipo ya no está disponible y no admite cambios.'
            : undefined
        }
        createLabel="Guardar anticipo"
      />
    </form>
  );
}
