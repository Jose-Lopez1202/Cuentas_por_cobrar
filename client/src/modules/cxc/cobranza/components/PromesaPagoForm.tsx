
import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  validateRequiredSelect,
  validateRequiredDate,
  validateDate,
  validateMoney,
  validateMaxLength,
  hasErrors,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, PromesaPago } from '@erp/contracts';
import { SearchableSelect } from '../../../../shared/components/SearchableSelect';
import { CampoUsuarioActual } from '../../../../shared/components/CampoUsuarioActual';

interface PromesaPagoFormProps {
  promesa?: PromesaPago | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const ESTADOS_PROMESA_PAGO = [
  'PENDIENTE',
  'CUMPLIDA',
  'INCUMPLIDA',
] as const;

const ESTADO_OPTIONS = ESTADOS_PROMESA_PAGO.map((e) => ({
  value: e,
  label: e,
}));

// Fecha actual de negocio en Guatemala, formato YYYY-MM-DD.
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

export const PromesaPagoForm = ({
  promesa,
  onSuccess,
  onCancel,
}: PromesaPagoFormProps) => {
  const isEditing = Boolean(promesa);

  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);

  const [idCliente, setIdCliente] = useState(
    promesa?.idCliente?.toString() ?? '',
  );

  const [idDocumento, setIdDocumento] = useState(
    promesa?.idDocumento?.toString() ?? '',
  );

  // Al crear, la fecha se establece automáticamente en Guatemala.
  const [fechaPromesa, setFechaPromesa] = useState(
    () => promesa?.fechaPromesa?.slice(0, 10) ?? hoyGuatemalaIso(),
  );

  // La fecha de compromiso sigue siendo opcional,
  // hasta confirmar el contrato y las reglas del backend.
  const [fechaCompromiso, setFechaCompromiso] = useState(
    promesa?.fechaCompromiso?.slice(0, 10) ?? '',
  );

  const [montoComprometido, setMontoComprometido] = useState(
    promesa?.montoComprometido?.toString() ?? '',
  );

  const [estado, setEstado] = useState(
    promesa?.estado ?? 'PENDIENTE',
  );

  const [observaciones, setObservaciones] = useState(
    promesa?.observaciones ?? '',
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
  // CARGAR DOCUMENTOS PENDIENTES DEL CLIENTE
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

  // =====================================================
  // DOCUMENTO SELECCIONADO
  // =====================================================

  const documentoSeleccionado = useMemo(
    () =>
      documentos.find(
        (documento) => Number(documento.id) === Number(idDocumento),
      ),
    [documentos, idDocumento],
  );

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

    // La fecha de la promesa no puede ser futura.
    const fechaPromesaErr = validateRequiredDate(
      fechaPromesa,
      'La fecha de la promesa',
      {
        notFuture: true,
        maxDate: hoy,
      },
    );

    if (fechaPromesaErr) {
      next.fechaPromesa = fechaPromesaErr;
    }

    // La fecha comprometida sí puede ser futura.
    // Solo debe ser igual o posterior a la promesa.
    if (fechaCompromiso) {
      const fechaCompromisoErr = validateDate(
        fechaCompromiso,
        'La fecha comprometida de pago',
        {
          notBefore: fechaPromesa
            ? {
                date: fechaPromesa,
                label: 'la fecha de la promesa',
              }
            : undefined,
        },
      );

      if (fechaCompromisoErr) {
        next.fechaCompromiso = fechaCompromisoErr;
      }
    }

    const montoErr = validateMoney(
      montoComprometido,
      'El monto comprometido',
      {
        required: true,
        positive: true,
      },
    );

    if (montoErr) {
      next.montoComprometido = montoErr;
    }

    if (
      !montoErr &&
      idDocumento &&
      documentoSeleccionado?.saldo !== undefined &&
      Number(montoComprometido) > Number(documentoSeleccionado.saldo)
    ) {
      next.montoComprometido =
        `El monto no puede superar el saldo pendiente del documento ` +
        `(${Number(documentoSeleccionado.saldo).toFixed(2)}).`;
    }

    const obsErr = validateMaxLength(
      observaciones,
      'Observaciones',
      500,
    );

    if (obsErr) {
      next.observaciones = obsErr;
    }

    return next;
  }, [
    idCliente,
    idDocumento,
    fechaPromesa,
    fechaCompromiso,
    montoComprometido,
    observaciones,
    documentoSeleccionado,
    hoy,
  ]);

  const isFormValid =
    !hasErrors(validationErrors) &&
    !isSubmitting;

  const errorFor = (
    field: string,
    value = '',
  ) =>
    errors[field] ??
    (value ? validationErrors[field] : undefined);

  // =====================================================
  // CAMBIO DE CLIENTE
  // =====================================================

  const handleClienteChange = (value: string) => {
    setIdCliente(value);
    setIdDocumento('');
    setDocumentos([]);
    setErrors({});
    setFormError(null);
  };

  // =====================================================
  // GUARDAR PROMESA
  // =====================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isSubmitting) {
      return;
    }

    // Revalidar la fecha actual al momento de guardar.
    const hoyActual = hoyGuatemalaIso();

    if (fechaPromesa > hoyActual) {
      setErrors({
        fechaPromesa:
          'La fecha de la promesa no puede ser futura.',
      });
      return;
    }

    if (!isFormValid) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const payload = {
      idCliente: Number(idCliente),
      idDocumento: idDocumento
        ? Number(idDocumento)
        : undefined,
      fechaPromesa,
      fechaCompromiso: fechaCompromiso || undefined,
      montoComprometido: Number(montoComprometido),
      estado,
      observaciones: observaciones.trim() || undefined,
    };

    try {
      if (isEditing) {
        await apiClient.patch(
          `/cxc/promesas-pago/${promesa!.idPromesa}`,
          payload,
        );
      } else {
        await apiClient.post(
          '/cxc/promesas-pago',
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
            : 'No se pudo guardar la promesa de pago',
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
      noValidate
      className="flex flex-col gap-4"
    >
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
        error={errorFor('idCliente', idCliente)}
        helperText="Cliente que realizó la promesa; campo obligatorio."
      />

      <Select
        label="Documento relacionado"
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
          idCliente
            ? 'Seleccionar documento (opcional)'
            : 'Selecciona un cliente primero'
        }
        isReadOnly={!idCliente}
        helperText={
          'Opcional; solo aparecen documentos pendientes del cliente. ' +
          'Si se selecciona uno, el monto no puede superar su saldo.'
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Fecha de la promesa"
          type="date"
          required
          max={hoy}
          value={fechaPromesa}
          onChange={(e: any) =>
            setFechaPromesa(e.target.value)
          }
          error={errorFor('fechaPromesa', fechaPromesa)}
          helperText="Fecha en que se registró la promesa; no puede ser futura."
        />

        <TextInput
          label="Fecha comprometida de pago"
          type="date"
          min={fechaPromesa || undefined}
          value={fechaCompromiso}
          onChange={(e: any) =>
            setFechaCompromiso(e.target.value)
          }
          error={errorFor(
            'fechaCompromiso',
            fechaCompromiso,
          )}
          helperText={
            'Fecha prevista de pago; puede ser futura, ' +
            'pero no anterior a la fecha de la promesa.'
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          label="Monto comprometido"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          step="0.01"
          min="0.01"
          required
          value={montoComprometido}
          onChange={(e: any) =>
            setMontoComprometido(e.target.value)
          }
          error={errorFor(
            'montoComprometido',
            montoComprometido,
          )}
          helperText={
            documentoSeleccionado?.saldo !== undefined
              ? `Mayor a 0, máximo 2 decimales y no mayor al saldo ${Number(documentoSeleccionado.saldo).toFixed(2)}.`
              : 'Mayor a 0 y máximo 2 decimales.'
          }
        />

        <Select
          label="Estado"
          required
          value={estado}
          onChange={(e: any) =>
            setEstado(e.target.value)
          }
          options={ESTADO_OPTIONS}
          helperText="Estado controlado de la promesa; evita valores libres o inconsistentes."
        />
      </div>

      <TextArea
        label="Observaciones"
        value={observaciones}
        onChange={(e: any) =>
          setObservaciones(e.target.value)
        }
        rows={3}
        maxLength={500}
        error={errorFor('observaciones', observaciones)}
        helperText="Detalle adicional; máximo 500 caracteres."
      />

      {!isEditing && <CampoUsuarioActual />}
      {formError && (
        <p
          role="alert"
          className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {formError}
        </p>
      )}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        createLabel="Crear promesa"
        isFormValid={isFormValid}
        blockers={validationErrors}
      />
    </form>
  );
};
