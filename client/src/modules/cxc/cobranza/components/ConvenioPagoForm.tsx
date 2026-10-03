import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select, TextArea, Checkbox } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import { todayIso, validateRequiredSelect, validateRequiredDate, validateMoney, validateRequiredNumber, validateMaxLength, hasErrors, type ValidationErrors } from '../../../../shared/validation';
import type { CatalogoOption, ConvenioPago } from '@erp/contracts';

interface ConvenioPagoFormProps { convenio?: ConvenioPago | null; onSuccess: () => void; onCancel: () => void; }
const ESTADOS_CONVENIO_PAGO = ['ACTIVO', 'CUMPLIDO', 'INCUMPLIDO', 'CANCELADO'] as const;
const ESTADO_OPTIONS = ESTADOS_CONVENIO_PAGO.map((e) => ({ value: e, label: e }));
<<<<<<< HEAD
const MAX_CUOTAS = 60;
=======
const ESTADO_NUEVO_OPTIONS = [{ value: 'ACTIVO', label: 'ACTIVO' }];
const MAX_CUOTAS = 18;
// Observaciones: solo texto (letras, espacios y . , ; : ' -). Sin números ni símbolos como $ % # " ( /
const OBSERVACIONES_INVALIDOS = /[^\p{L}\s.,;:'’-]/gu;
const OBSERVACIONES_VALIDAS = /^[\p{L}\s.,;:'’-]*$/u;
const soloTexto = (valor: string) => valor.replace(OBSERVACIONES_INVALIDOS, '');

const round2 = (valor: number) => Math.round(valor * 100) / 100;
const formatQ = (valor: number) => `Q ${valor.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// La etiqueta del servidor ya trae "(saldo: N)"; el saldo se muestra aparte y formateado.
const nombreDocumento = (doc: CatalogoOption) => doc.label.replace(/\s*\(saldo:[^)]*\)\s*$/i, '');
>>>>>>> origin/develop

export const ConvenioPagoForm = ({ convenio, onSuccess, onCancel }: ConvenioPagoFormProps) => {
  const isEditing = !!convenio;
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [documentosPendientes, setDocumentosPendientes] = useState<CatalogoOption[]>([]);
<<<<<<< HEAD
  const [montosIncluidos, setMontosIncluidos] = useState<Record<number, string>>({});
  const [idCliente, setIdCliente] = useState(convenio?.idCliente?.toString() ?? '');
  const [fechaConvenio, setFechaConvenio] = useState(convenio?.fechaConvenio?.slice(0, 10) ?? '');
  const [montoDeuda, setMontoDeuda] = useState(convenio?.montoDeuda?.toString() ?? '');
=======
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [idCliente, setIdCliente] = useState(convenio?.idCliente?.toString() ?? '');
  const [fechaConvenio, setFechaConvenio] = useState(convenio?.fechaConvenio?.slice(0, 10) ?? todayIso());
  const [montoDeuda, setMontoDeuda] = useState(convenio?.montoDeuda?.toString() ?? '');
  const [montoTocado, setMontoTocado] = useState(false);
>>>>>>> origin/develop
  const [numeroCuotas, setNumeroCuotas] = useState(convenio?.numeroCuotas?.toString() ?? '');
  const [estado, setEstado] = useState(convenio?.estado ?? 'ACTIVO');
  const [observaciones, setObservaciones] = useState(convenio?.observaciones ?? '');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(() => setClientes([])); }, []);

  useEffect(() => {
<<<<<<< HEAD
    if (isEditing || !idCliente) { setDocumentosPendientes([]); setMontosIncluidos({}); return; }
    apiClient
      .get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/documentos-pendientes`)
      .then(setDocumentosPendientes)
      .catch(() => setDocumentosPendientes([]));
    setMontosIncluidos({});
  }, [idCliente, isEditing]);

  const documentosIncluidos = Object.keys(montosIncluidos).map(Number).filter((id) => montosIncluidos[id] !== undefined);
  const sumaIncluida = documentosIncluidos.reduce((acc, id) => acc + (Number(montosIncluidos[id]) || 0), 0);

  const toggleDocumento = (doc: CatalogoOption, checked: boolean) => {
    setMontosIncluidos((prev) => {
      const next = { ...prev };
      if (checked) next[Number(doc.id)] = String(doc.saldo ?? 0);
      else delete next[Number(doc.id)];
      return next;
    });
  };
=======
    if (isEditing) return;
    setSeleccionados(new Set());
    setMontoDeuda('');
    setMontoTocado(false);
    if (!idCliente) { setDocumentosPendientes([]); return; }
    // Si el usuario cambia de cliente antes de que responda la petición anterior, se descarta.
    let cancelado = false;
    apiClient
      .get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/documentos-pendientes`)
      .then((docs) => { if (!cancelado) setDocumentosPendientes(docs); })
      .catch(() => { if (!cancelado) setDocumentosPendientes([]); });
    return () => { cancelado = true; };
  }, [idCliente, isEditing]);

  // Los documentos llegan del más antiguo al más reciente (por vencimiento) y así se aplica el monto.
  const docsSeleccionados = useMemo(
    () => documentosPendientes.filter((doc) => seleccionados.has(Number(doc.id))),
    [documentosPendientes, seleccionados],
  );
  // Lo que realmente se debe en los documentos elegidos: es el tope del monto del convenio.
  const totalSeleccionado = round2(docsSeleccionados.reduce((acc, doc) => acc + Number(doc.saldo ?? 0), 0));
  const deudaPendiente = round2(documentosPendientes.reduce((acc, doc) => acc + Number(doc.saldo ?? 0), 0));
  const montoNum = Number(montoDeuda);
  const montoValido = montoDeuda !== '' && Number.isFinite(montoNum) && montoNum > 0;

  // El monto sigue al total seleccionado mientras el usuario no lo toque; si ya lo ajustó, se respeta
  // salvo que el total baje por debajo de lo escrito (entonces se recorta al nuevo tope).
  useEffect(() => {
    if (isEditing) return;
    if (totalSeleccionado <= 0) { setMontoDeuda(''); setMontoTocado(false); return; }
    setMontoDeuda((actual) => {
      if (!montoTocado) return totalSeleccionado.toFixed(2);
      return Number(actual) > totalSeleccionado ? totalSeleccionado.toFixed(2) : actual;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeleccionado, isEditing]);

  // Reparto del monto entre los documentos (más antiguo primero), en centavos para no arrastrar decimales.
  const reparto = useMemo(() => {
    let restante = montoValido ? Math.round(montoNum * 100) : 0;
    return docsSeleccionados.map((doc) => {
      const saldoCentavos = Math.round(Number(doc.saldo ?? 0) * 100);
      const asignado = Math.min(saldoCentavos, restante);
      restante -= asignado;
      return { doc, incluido: asignado / 100 };
    });
  }, [docsSeleccionados, montoNum, montoValido]);
  const incluidoPorDoc = (id: number) => reparto.find((r) => Number(r.doc.id) === id)?.incluido ?? 0;

  const toggleDocumento = (doc: CatalogoOption, checked: boolean) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(Number(doc.id)); else next.delete(Number(doc.id));
      return next;
    });
  };
  const seleccionarTodos = () => setSeleccionados(new Set(documentosPendientes.map((doc) => Number(doc.id))));

  const montoError = useMemo(() => {
    if (isEditing || montoDeuda === '') return undefined;
    const formato = validateMoney(montoDeuda, 'El monto de la deuda', { required: true, positive: true });
    if (formato) return formato;
    if (montoNum > totalSeleccionado + 0.005) return `No puede superar lo que se debe en los documentos seleccionados (${formatQ(totalSeleccionado)}).`;
    return undefined;
  }, [isEditing, montoDeuda, montoNum, totalSeleccionado]);

  const cuotasNum = Number(numeroCuotas);
  const resumenCuotas = useMemo(() => {
    if (isEditing || !Number.isInteger(cuotasNum) || cuotasNum < 1 || cuotasNum > MAX_CUOTAS || !montoValido || montoError) return null;
    // Misma regla que el servidor: cuotas iguales en centavos y el residuo cae en la última.
    const totalCentavos = Math.round(montoNum * 100);
    const base = Math.floor(totalCentavos / cuotasNum);
    const residuo = totalCentavos - base * cuotasNum;
    if (cuotasNum === 1) return `1 cuota de ${formatQ(totalCentavos / 100)}`;
    return residuo === 0
      ? `${cuotasNum} cuotas de ${formatQ(base / 100)}`
      : `${cuotasNum - 1} cuotas de ${formatQ(base / 100)} y una última de ${formatQ((base + residuo) / 100)}`;
  }, [isEditing, cuotasNum, montoNum, montoValido, montoError]);

  const observacionesCambiaron = !isEditing || observaciones !== (convenio?.observaciones ?? '');
>>>>>>> origin/develop

  const validationErrors = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const clienteErr = validateRequiredSelect(idCliente, 'un cliente'); if (clienteErr) next.idCliente = clienteErr;
<<<<<<< HEAD
    const fechaErr = validateRequiredDate(fechaConvenio, 'La fecha del convenio', { notFuture: true }); if (fechaErr) next.fechaConvenio = fechaErr;
    const montoErr = validateMoney(montoDeuda, 'El monto de la deuda', { required: true, positive: true }); if (montoErr) next.montoDeuda = montoErr;
    const cuotasErr = validateRequiredNumber(numeroCuotas, 'El número de cuotas', { integer: true, min: 1, max: MAX_CUOTAS }); if (cuotasErr) next.numeroCuotas = cuotasErr;
    const obsErr = validateMaxLength(observaciones, 'Observaciones', 500); if (obsErr) next.observaciones = obsErr;
    if (!isEditing) {
      if (documentosIncluidos.length === 0) {
        next.documentos = 'Selecciona al menos un documento que cubra el convenio.';
      } else if (!montoErr && Math.abs(sumaIncluida - Number(montoDeuda)) > 0.005) {
        next.documentos = `La suma de los montos incluidos (Q ${sumaIncluida.toFixed(2)}) debe ser igual al monto de la deuda (Q ${Number(montoDeuda || 0).toFixed(2)}).`;
      }
    }
    return next;
  }, [idCliente, fechaConvenio, montoDeuda, numeroCuotas, observaciones, isEditing, documentosIncluidos.length, sumaIncluida]);
=======
    // La regla "no anterior a hoy" aplica solo al crear: al editar la fecha original es de solo lectura.
    if (!isEditing) { const fechaErr = validateRequiredDate(fechaConvenio, 'La fecha del convenio', { minDate: todayIso() }); if (fechaErr) next.fechaConvenio = fechaErr; }
    const cuotasErr = validateRequiredNumber(numeroCuotas, 'El número de cuotas', { integer: true, min: 1, max: MAX_CUOTAS }); if (cuotasErr) next.numeroCuotas = cuotasErr;
    if (observacionesCambiaron) {
      const obsErr = validateMaxLength(observaciones, 'Observaciones', 500); if (obsErr) next.observaciones = obsErr;
      else if (!OBSERVACIONES_VALIDAS.test(observaciones)) next.observaciones = 'Las observaciones solo admiten texto: letras, espacios y . , ; : - (sin números ni símbolos).';
    }
    if (!isEditing) {
      if (docsSeleccionados.length === 0) next.documentos = 'Selecciona al menos un documento que cubra el convenio.';
      else if (montoDeuda === '') next.montoDeuda = 'El monto de la deuda es obligatorio.';
      else if (montoError) next.montoDeuda = montoError;
      else if (reparto.some((r) => r.incluido <= 0)) next.documentos = 'El monto no alcanza a cubrir todos los documentos seleccionados (se aplica del más antiguo al más reciente). Desmarca alguno o aumenta el monto.';
    }
    return next;
  }, [idCliente, fechaConvenio, numeroCuotas, observaciones, observacionesCambiaron, isEditing, docsSeleccionados.length, montoDeuda, montoError, reparto]);
>>>>>>> origin/develop
  const isFormValid = !hasErrors(validationErrors);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null);
    if (!isFormValid) { setErrors(validationErrors); return; }
    setErrors({}); setIsSubmitting(true);
<<<<<<< HEAD
    const payload = isEditing
      ? { estado, observaciones: observaciones.trim() || undefined }
      : {
          idCliente: Number(idCliente),
          fechaConvenio,
          montoDeuda: Number(montoDeuda),
          numeroCuotas: Number(numeroCuotas),
          estado,
          observaciones: observaciones.trim() || undefined,
          documentos: documentosIncluidos.map((id) => ({ idDocumento: id, montoIncluido: Number(montosIncluidos[id]) })),
=======
    // Al editar, "sin observaciones" se envía como null para poder borrar el texto guardado.
    const payload = isEditing
      ? { estado, ...(observacionesCambiaron ? { observaciones: observaciones.trim() || null } : {}) }
      : {
          idCliente: Number(idCliente),
          fechaConvenio,
          montoDeuda: round2(montoNum),
          numeroCuotas: Number(numeroCuotas),
          estado: 'ACTIVO',
          observaciones: observaciones.trim() || undefined,
          documentos: reparto.filter((r) => r.incluido > 0).map((r) => ({ idDocumento: Number(r.doc.id), montoIncluido: r.incluido })),
>>>>>>> origin/develop
        };
    try {
      if (isEditing) await apiClient.patch(`/cxc/convenios-pago/${convenio!.idConvenio}`, payload); else await apiClient.post('/cxc/convenios-pago', payload);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const fieldErrors: ValidationErrors = {}; (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => { fieldErrors[d.campo] = d.mensaje; }); setErrors(fieldErrors);
      } else setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el convenio');
    } finally { setIsSubmitting(false); }
  };

<<<<<<< HEAD
=======
  // Errores en vivo: se muestran en cuanto el campo tiene un valor (el botón queda bloqueado mientras haya errores).
  const vivo = (campo: string, tieneValor: boolean) => errors[campo] ?? (tieneValor ? validationErrors[campo] : undefined);
  // El aviso de documentos solo se pone en rojo tras intentar guardar o cuando ya hay documentos y monto válidos.
  const docMensajeError = errors.documentos ?? (docsSeleccionados.length > 0 && montoValido ? validationErrors.documentos : undefined);

>>>>>>> origin/develop
  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Select label="Cliente" required value={idCliente} onChange={(e: any) => setIdCliente(e.target.value)} options={clientes.map((c) => ({ value: c.id, label: c.label }))} error={errors.idCliente} isReadOnly={isEditing} helperText={isEditing ? 'El cliente queda fijo porque el convenio ya tiene plan de cuotas.' : 'Cliente con quien se formaliza el convenio.'} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
<<<<<<< HEAD
        <TextInput label="Fecha del convenio" type="date" required max={todayIso()} value={fechaConvenio} onChange={(e: any) => setFechaConvenio(e.target.value)} error={errors.fechaConvenio} isReadOnly={isEditing} helperText={isEditing ? 'La fecha original no cambia al editar.' : 'Fecha real del acuerdo; no puede ser futura.'} />
        <TextInput label="Monto de la deuda" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0.01" required value={montoDeuda} onChange={(e: any) => setMontoDeuda(e.target.value)} error={errors.montoDeuda} isReadOnly={isEditing} helperText={isEditing ? 'El monto queda fijo porque ya generó las cuotas.' : 'Debe coincidir con la suma de los documentos que selecciones abajo.'} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="Número de cuotas" type="number" restriction="integer" min="1" max={String(MAX_CUOTAS)} step="1" required value={numeroCuotas} onChange={(e: any) => setNumeroCuotas(e.target.value)} error={errors.numeroCuotas} isReadOnly={isEditing} helperText={isEditing ? 'No se modifica porque el plan de cuotas ya existe.' : `Solo enteros entre 1 y ${MAX_CUOTAS}; las cuotas se generan automáticamente.`} />
        <Select label="Estado" required value={estado} onChange={(e: any) => setEstado(e.target.value)} options={ESTADO_OPTIONS} helperText="El sistema también lo cambia solo: CUMPLIDO al pagar todas las cuotas, INCUMPLIDO al recalcular con cuotas vencidas." />
=======
        <TextInput label="Fecha del convenio" type="date" required min={todayIso()} value={fechaConvenio} onChange={(e: any) => setFechaConvenio(e.target.value)} error={vivo('fechaConvenio', !!fechaConvenio)} isReadOnly={isEditing} helperText={isEditing ? 'La fecha original no cambia al editar.' : 'Fecha del acuerdo; no puede ser anterior a hoy. Las cuotas vencen mes a mes desde esta fecha.'} />
        <TextInput
          label="Monto de la deuda"
          type="number"
          restriction="decimal"
          decimalPlaces={2}
          step="0.01"
          min="0.01"
          max={!isEditing && totalSeleccionado > 0 ? String(totalSeleccionado) : undefined}
          required
          value={montoDeuda}
          onChange={(e: any) => { setMontoDeuda(e.target.value); setMontoTocado(true); }}
          error={errors.montoDeuda ?? montoError}
          isReadOnly={isEditing || totalSeleccionado <= 0}
          placeholder="0.00"
          helperText={isEditing ? 'El monto queda fijo porque ya generó las cuotas.' : (totalSeleccionado > 0 ? `Puedes bajarlo para negociar una parte. Máximo: ${formatQ(totalSeleccionado)} (lo que se debe en los documentos seleccionados).` : 'Primero selecciona los documentos que cubre el convenio.')}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="Número de cuotas" type="number" restriction="integer" min="1" max={String(MAX_CUOTAS)} step="1" required value={numeroCuotas} onChange={(e: any) => setNumeroCuotas(e.target.value)} error={vivo('numeroCuotas', !!numeroCuotas)} isReadOnly={isEditing} helperText={isEditing ? 'No se modifica porque el plan de cuotas ya existe.' : (resumenCuotas ? `Estimado: ${resumenCuotas}.` : `Solo enteros entre 1 y ${MAX_CUOTAS}; las cuotas se generan automáticamente.`)} />
        <Select label="Estado" required value={isEditing ? estado : 'ACTIVO'} onChange={(e: any) => setEstado(e.target.value)} options={isEditing ? ESTADO_OPTIONS : ESTADO_NUEVO_OPTIONS} isReadOnly={!isEditing} helperText={isEditing ? 'El sistema también lo cambia solo: CUMPLIDO al pagar todas las cuotas, INCUMPLIDO al recalcular con cuotas vencidas.' : 'Un convenio nuevo siempre inicia ACTIVO.'} />
>>>>>>> origin/develop
      </div>

      {!isEditing && (
        <div className="flex flex-col gap-2">
<<<<<<< HEAD
          <label className="text-xs font-semibold text-slate-700">
            Documentos que cubre el convenio <span className="text-red-500">*</span>
          </label>
=======
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">
              Documentos que cubre el convenio <span className="text-red-500">*</span>
            </label>
            {documentosPendientes.length > 1 && (
              <button type="button" onClick={seleccionarTodos} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                Seleccionar todos
              </button>
            )}
          </div>
>>>>>>> origin/develop
          {!idCliente ? (
            <p className="text-xs text-slate-400">Selecciona un cliente primero.</p>
          ) : documentosPendientes.length === 0 ? (
            <p className="text-xs text-slate-400">Este cliente no tiene documentos con saldo pendiente.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {documentosPendientes.map((doc) => {
<<<<<<< HEAD
                const checked = montosIncluidos[Number(doc.id)] !== undefined;
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox checked={checked} onChange={(e: any) => toggleDocumento(doc, e.target.checked)} />
                    <span className="flex-1 text-sm text-slate-700">{doc.label}</span>
                    {checked && (
                      <TextInput
                        type="number"
                        restriction="decimal"
                        decimalPlaces={2}
                        step="0.01"
                        min="0.01"
                        max={String(doc.saldo ?? 0)}
                        value={montosIncluidos[Number(doc.id)]}
                        onChange={(e: any) => setMontosIncluidos((prev) => ({ ...prev, [Number(doc.id)]: e.target.value }))}
                        className="w-32"
                      />
                    )}
=======
                const id = Number(doc.id);
                const checked = seleccionados.has(id);
                const incluido = incluidoPorDoc(id);
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox checked={checked} onChange={(e: any) => toggleDocumento(doc, e.target.checked)} />
                    <span className="min-w-0 flex-1 text-sm text-slate-700">{nombreDocumento(doc)}</span>
                    <div className="text-right text-xs leading-tight">
                      <div className="text-slate-500">Saldo {formatQ(Number(doc.saldo ?? 0))}</div>
                      {checked && montoValido && (
                        <div className={incluido > 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
                          {incluido > 0 ? `Se incluye ${formatQ(incluido)}` : 'Sin cobertura'}
                        </div>
                      )}
                    </div>
>>>>>>> origin/develop
                  </div>
                );
              })}
            </div>
          )}
<<<<<<< HEAD
          <p className={`text-xs ${errors.documentos ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
            {errors.documentos ?? `Suma incluida: Q ${sumaIncluida.toFixed(2)} de Q ${Number(montoDeuda || 0).toFixed(2)}`}
=======
          <p className={`text-xs ${docMensajeError ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
            {docMensajeError ?? `Seleccionado: ${formatQ(totalSeleccionado)} en ${docsSeleccionados.length} documento(s)${deudaPendiente > 0 ? ` de ${formatQ(deudaPendiente)} pendientes del cliente` : ''}. El monto se aplica del documento más antiguo al más reciente.`}
>>>>>>> origin/develop
          </p>
        </div>
      )}

<<<<<<< HEAD
      <TextArea label="Observaciones" value={observaciones} onChange={(e: any) => setObservaciones(e.target.value)} rows={3} maxLength={500} error={errors.observaciones} helperText="Condiciones o notas adicionales del acuerdo; máximo 500 caracteres." />
=======
      <TextArea label="Observaciones" value={observaciones} onChange={(e: any) => setObservaciones(soloTexto(e.target.value))} rows={3} maxLength={500} error={errors.observaciones} helperText="Solo texto: letras, espacios y . , ; : - (sin números ni símbolos como $ % # &quot; ( /). Máximo 500 caracteres." />
>>>>>>> origin/develop
      {formError && <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
      <FormActionButtons onCancel={onCancel} isSubmitting={isSubmitting} isEditing={isEditing} createLabel="Crear convenio" isFormValid={isFormValid} />
    </form>
  );
};
