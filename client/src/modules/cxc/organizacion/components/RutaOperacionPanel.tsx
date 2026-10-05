import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, UserRound, Wallet, ClipboardList, RefreshCw, Plus } from 'lucide-react';
import type { RutaOperacion, CobradorPerfil, RutaDocumentoPendiente, RutaPagoDisponible, CatalogoOption } from '@erp/contracts';
import { apiClient, ApiError } from '../../../../shared/api';
import { Button, TextInput, Select, TextArea } from '../../../../shared/ui-kit';
import { Modal } from '../../../../shared/components/Modal';
import { RutaMap } from './RutaMap';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import {
  hasErrors,
  todayIso,
  validateMaxLength,
  validateMoney,
  validateRequired,
  validateRequiredDate,
  validateRequiredNumber,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';

const card = 'bg-white border border-slate-200 rounded-xl p-5 space-y-4';
const formErrorClass = 'text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2';
const money = (value: number) => Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Tab = 'documentos' | 'bitacora';
type ModalKind = 'asignar' | 'cobro' | 'bitacora';

/** Traduce un error de la API a errores por campo + un mensaje general. */
function mapApiError(err: unknown, fallback: string): { fields: ValidationErrors; general: string | null } {
  if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
    const fields: ValidationErrors = {};
    (err.details as Array<{ campo?: string; mensaje?: string }>).forEach((d) => {
      if (d.campo && d.mensaje) fields[d.campo] = d.mensaje;
    });
    if (Object.keys(fields).length > 0) return { fields, general: null };
  }
  return { fields: {}, general: err instanceof Error && err.message ? err.message : fallback };
}

const toOptions = (items: CatalogoOption[]) => items.map((e) => ({ value: String(e.id), label: e.label }));

/** Estado común de un formulario en línea: errores por campo, error general y envío. */
function useRutaForm(onSubmit: () => Promise<void>, onDone: () => void, validation: ValidationErrors, fallback: string) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isFormValid = !hasErrors(validation);
  const errorFor = (field: string, value: string) => errors[field] ?? (value ? validation[field] : undefined);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isFormValid) { setErrors(validation); return; }
    setErrors({}); setGeneral(null); setSubmitting(true);
    try {
      await onSubmit();
      onDone();
    } catch (err) {
      const mapped = mapApiError(err, fallback);
      setErrors(mapped.fields); setGeneral(mapped.general);
    } finally { setSubmitting(false); }
  };
  return { errors, general, submitting, isFormValid, errorFor, handleSubmit };
}

interface AsignacionPayload {
  idDocumento: number; idEmpleado: number; montoAsignado: number; direccion: string;
  latitud: number; longitud: number; ordenVisita: number;
}

function AsignacionForm({ data, docs, empleados, onSubmit, onClose }: {
  data?: RutaOperacion; docs: RutaDocumentoPendiente[]; empleados: CatalogoOption[]; onClose: () => void;
  onSubmit: (payload: AsignacionPayload) => Promise<void>;
}) {
  const siguienteOrden = String((data?.asignaciones.length ?? 0) + 1);
  const [idDocumento, setIdDocumento] = useState('');
  const [idEmpleado, setIdEmpleado] = useState('');
  const [monto, setMonto] = useState('');
  const [orden, setOrden] = useState(siguienteOrden);
  const [direccion, setDireccion] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');

  useEffect(() => { setOrden(siguienteOrden); }, [siguienteOrden]);

  const disponibles = docs.filter((d) => d.DISPONIBLE > 0 && !data?.asignaciones.some((a) => a.ID_DOCUMENTO === d.ID_DOCUMENTO));
  const doc = disponibles.find((d) => String(d.ID_DOCUMENTO) === idDocumento);

  const validation: ValidationErrors = {};
  const docErr = validateRequiredSelect(idDocumento, 'un documento'); if (docErr) validation.idDocumento = docErr;
  const empErr = validateRequiredSelect(idEmpleado, 'un cobrador'); if (empErr) validation.idEmpleado = empErr;
  const montoErr = validateMoney(monto, 'El monto asignado', { required: true, positive: true });
  if (montoErr) validation.montoAsignado = montoErr;
  else if (doc && Number(monto) > doc.DISPONIBLE) {
    validation.montoAsignado = `El monto asignado no puede superar lo disponible del documento (${doc.MONEDA} ${money(doc.DISPONIBLE)}).`;
  }
  const ordenErr = validateRequiredNumber(orden, 'El orden de visita', { integer: true, positive: true }); if (ordenErr) validation.ordenVisita = ordenErr;
  const dirErr = validateRequired(direccion, 'La dirección') ?? validateMaxLength(direccion, 'La dirección', 250); if (dirErr) validation.direccion = dirErr;
  const latErr = validateRequiredNumber(latitud, 'La latitud', { min: -90, max: 90 }); if (latErr) validation.latitud = latErr;
  const lonErr = validateRequiredNumber(longitud, 'La longitud', { min: -180, max: 180 }); if (lonErr) validation.longitud = lonErr;

  const pick = !validation.latitud && !validation.longitud && latitud && longitud ? { lat: Number(latitud), lon: Number(longitud) } : null;
  const reset = () => {
    setIdDocumento(''); setIdEmpleado(''); setMonto(''); setDireccion(''); setLatitud(''); setLongitud('');
  };
  const f = useRutaForm(
    () => onSubmit({
      idDocumento: Number(idDocumento), idEmpleado: Number(idEmpleado), montoAsignado: Number(monto),
      direccion: direccion.trim(), latitud: Number(latitud), longitud: Number(longitud), ordenVisita: Number(orden),
    }),
    () => { reset(); onClose(); }, validation, 'No se pudo asignar el documento',
  );

  return <form onSubmit={f.handleSubmit} className="flex flex-col gap-4" noValidate>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Select label="Documento" required value={idDocumento} onChange={(e: any) => { setIdDocumento(e.target.value); }}
        options={disponibles.map((d) => ({ value: String(d.ID_DOCUMENTO), label: `${d.DOCUMENTO} · ${d.CLIENTE} · disponible ${d.MONEDA} ${money(d.DISPONIBLE)}` }))}
        error={f.errors.idDocumento}
        helperText={disponibles.length === 0 ? 'No hay documentos pendientes disponibles: todos tienen saldo cero o ya están asignados a una ruta.' : 'Documento con saldo disponible que aún no está asignado a esta ruta.'} />
      <Select label="Cobrador" required value={idEmpleado} onChange={(e: any) => setIdEmpleado(e.target.value)}
        options={toOptions(empleados)} error={f.errors.idEmpleado} helperText="Empleado responsable de cobrar este documento." />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Monto asignado" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0.01" required
        max={doc ? String(doc.DISPONIBLE) : undefined} value={monto} onChange={(e: any) => setMonto(e.target.value)}
        error={f.errorFor('montoAsignado', monto)} placeholder="Ej. 500.00"
        helperText={doc ? `Mayor a 0 y hasta ${doc.MONEDA} ${money(doc.DISPONIBLE)} (disponible del documento).` : 'Mayor a 0; máximo 2 decimales. Selecciona primero el documento.'} />
      <TextInput label="Orden de visita" type="number" restriction="integer" min="1" required value={orden}
        onChange={(e: any) => setOrden(e.target.value)} error={f.errorFor('ordenVisita', orden)} placeholder="Ej. 1"
        helperText="Solo números enteros positivos." />
    </div>
    <TextInput label="Dirección" required maxLength={250} value={direccion} onChange={(e: any) => setDireccion(e.target.value)}
      error={f.errorFor('direccion', direccion)} placeholder="Ej. 39 calle petapa 18-45"
      helperText="Dirección de la visita; máximo 250 caracteres." />
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-700">Ubicación en el mapa</span>
      <RutaMap heightClass="h-56" pick={pick} onPick={(lat, lon) => { setLatitud(lat.toFixed(6)); setLongitud(lon.toFixed(6)); }} />
      <span className="text-xs text-slate-500">Haz clic en el mapa para fijar la ubicación; también puedes escribir las coordenadas.</span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Latitud" type="number" restriction="decimal" allowNegative decimalPlaces={7} step="any" min="-90" max="90" required
        value={latitud} onChange={(e: any) => setLatitud(e.target.value)} error={f.errorFor('latitud', latitud)}
        placeholder="Ej. 14.6349" helperText="Entre -90 y 90." />
      <TextInput label="Longitud" type="number" restriction="decimal" allowNegative decimalPlaces={7} step="any" min="-180" max="180" required
        value={longitud} onChange={(e: any) => setLongitud(e.target.value)} error={f.errorFor('longitud', longitud)}
        placeholder="Ej. -90.5069" helperText="Entre -180 y 180." />
    </div>
    {f.general && <p role="alert" className={formErrorClass}>{f.general}</p>}
    <FormActionButtons onCancel={onClose} isSubmitting={f.submitting} isFormValid={f.isFormValid}
      blockers={validation} createLabel="Asignar documento" confirmTitle="Confirmar asignación"
      confirmMessage="¿Asignar este documento a la ruta con el cobrador y monto indicados?" />
  </form>;
}

interface CobroPayload { idAsignacion: number; idPago: number; idEmpleado: number; monto: number; fecha: string }

function CobroForm({ data, pagos, empleados, onSubmit, onClose }: {
  data?: RutaOperacion; pagos: RutaPagoDisponible[]; empleados: CatalogoOption[]; onClose: () => void;
  onSubmit: (payload: CobroPayload) => Promise<void>;
}) {
  const [idAsignacion, setIdAsignacion] = useState('');
  const [idPago, setIdPago] = useState('');
  const [idEmpleado, setIdEmpleado] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(todayIso());

  const cobro = data?.asignaciones.find((a) => String(a.ID_ASIGNACION) === idAsignacion);
  const pagosCliente = pagos.filter((p) => p.ID_CLIENTE === cobro?.ID_CLIENTE && p.ID_MONEDA === cobro?.ID_MONEDA);
  const pago = pagosCliente.find((p) => String(p.ID_PAGO) === idPago);
  const restante = cobro ? Math.max(0, cobro.MONTO_ASIGNADO - cobro.MONTO_REGISTRADO) : undefined;
  const limite = cobro ? Math.max(0, Math.min(restante ?? 0, cobro.SALDO_DOCUMENTO, pago ? pago.DISPONIBLE : Infinity)) : undefined;

  const validation: ValidationErrors = {};
  const asigErr = validateRequiredSelect(idAsignacion, 'un documento asignado'); if (asigErr) validation.idAsignacion = asigErr;
  if (cobro && pagosCliente.length === 0) {
    validation.idPago = 'No hay pagos disponibles de este cliente y moneda. Registra uno en Pagos y pulsa Actualizar.';
  } else {
    const pagoErr = validateRequiredSelect(idPago, 'un pago disponible'); if (pagoErr) validation.idPago = pagoErr;
  }
  const empErr = validateRequiredSelect(idEmpleado, 'el empleado que registra'); if (empErr) validation.idEmpleado = empErr;
  const montoErr = validateMoney(monto, 'El monto a aplicar', { required: true, positive: true });
  if (montoErr) validation.monto = montoErr;
  else if (limite !== undefined && Number(monto) > limite) {
    const causa = Number(monto) > (restante ?? Infinity) ? 'lo que resta por cobrar en la ruta'
      : Number(monto) > (cobro?.SALDO_DOCUMENTO ?? Infinity) ? 'el saldo actual del documento'
        : 'el monto disponible del pago';
    validation.monto = `El monto a aplicar no puede superar ${causa} (${money(limite)}).`;
  }
  const fechaErr = validateRequiredDate(fecha, 'La fecha de aplicación', { notFuture: true }); if (fechaErr) validation.fecha = fechaErr;
  const sinCobro = cobro && limite === 0 ? 'Este documento ya no tiene saldo por cobrar en la ruta.' : undefined;
  if (sinCobro) validation.idAsignacion = sinCobro;

  const reset = () => { setIdAsignacion(''); setIdPago(''); setMonto(''); setFecha(todayIso()); };
  const f = useRutaForm(
    () => onSubmit({ idAsignacion: Number(idAsignacion), idPago: Number(idPago), idEmpleado: Number(idEmpleado), monto: Number(monto), fecha }),
    () => { reset(); onClose(); }, validation, 'No se pudo aplicar el cobro',
  );

  return <form onSubmit={f.handleSubmit} className="flex flex-col gap-4" noValidate>
    <Select label="Documento asignado" required value={idAsignacion}
      onChange={(e: any) => { setIdAsignacion(e.target.value); setIdPago(''); }}
      options={(data?.asignaciones ?? []).map((a) => ({ value: String(a.ID_ASIGNACION), label: `${a.DOCUMENTO} · ${a.CLIENTE} · ${a.COBRADOR}` }))}
      error={f.errors.idAsignacion ?? (idAsignacion ? validation.idAsignacion : undefined)}
      helperText={(data?.asignaciones.length ?? 0) === 0 ? 'Primero asigna un documento a la ruta en la pestaña Documentos y mapa.' : 'Documento de la ruta al que se aplicará el cobro.'} />
    {cobro && <p className="text-sm bg-blue-50 text-blue-900 p-3 rounded-lg">
      Cobrador: {cobro.COBRADOR} · Restante asignado: {cobro.MONEDA} {money(restante ?? 0)} · Saldo del documento: {money(cobro.SALDO_DOCUMENTO)}
    </p>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Select label="Pago disponible" required value={idPago} onChange={(e: any) => setIdPago(e.target.value)}
        options={pagosCliente.map((p) => ({ value: String(p.ID_PAGO), label: `${p.REFERENCIA} · ${p.MONEDA} ${money(p.DISPONIBLE)}` }))}
        error={f.errors.idPago ?? (cobro && pagosCliente.length === 0 ? validation.idPago : undefined)}
        helperText={cobro ? 'Pagos del mismo cliente y moneda con monto disponible.' : 'Selecciona primero el documento asignado.'} />
      <Select label="Empleado que registra" required value={idEmpleado} onChange={(e: any) => setIdEmpleado(e.target.value)}
        options={toOptions(empleados)} error={f.errors.idEmpleado} helperText="Queda como responsable en el historial y el recibo." />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Monto a aplicar" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0.01" required
        max={limite !== undefined ? String(limite) : undefined} value={monto} onChange={(e: any) => setMonto(e.target.value)}
        error={f.errorFor('monto', monto)} placeholder="Ej. 100.00"
        helperText={limite !== undefined ? `Mayor a 0 y hasta ${money(limite)} (el menor entre lo restante, el saldo del documento y el pago).` : 'Mayor a 0; máximo 2 decimales.'} />
      <TextInput label="Fecha de aplicación" type="date" required max={todayIso()} value={fecha}
        onChange={(e: any) => setFecha(e.target.value)} error={f.errorFor('fecha', fecha)}
        helperText="No puede ser una fecha futura." />
    </div>
    {f.general && <p role="alert" className={formErrorClass}>{f.general}</p>}
    <FormActionButtons onCancel={onClose} isSubmitting={f.submitting} isFormValid={f.isFormValid}
      blockers={validation} createLabel="Aplicar cobro y generar recibo" confirmTitle="Confirmar cobro"
      confirmMessage="Se aplicará el pago al documento, se reducirá su saldo y se generará el recibo. ¿Continuar?" />
  </form>;
}

const TIPOS_BITACORA = [
  { value: 'VISITA', label: 'Visita realizada' },
  { value: 'INCIDENCIA', label: 'Incidencia' },
  { value: 'REPROGRAMACION', label: 'Reprogramación' },
];

function BitacoraForm({ data, onSubmit, onClose }: {
  data?: RutaOperacion; onClose: () => void;
  onSubmit: (payload: { idAsignacion: number; tipo: string; observaciones: string }) => Promise<void>;
}) {
  const [idAsignacion, setIdAsignacion] = useState('');
  const [tipo, setTipo] = useState('VISITA');
  const [observaciones, setObservaciones] = useState('');

  const validation: ValidationErrors = {};
  const asigErr = validateRequiredSelect(idAsignacion, 'un documento asignado'); if (asigErr) validation.idAsignacion = asigErr;
  const obsErr = validateRequired(observaciones, 'Las observaciones') ?? validateMaxLength(observaciones, 'Las observaciones', 500);
  if (obsErr) validation.observaciones = obsErr;

  const f = useRutaForm(
    () => onSubmit({ idAsignacion: Number(idAsignacion), tipo, observaciones: observaciones.trim() }),
    onClose, validation, 'No se pudo guardar la actividad',
  );

  return <form onSubmit={f.handleSubmit} className="flex flex-col gap-4" noValidate>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Select label="Documento asignado" required value={idAsignacion} onChange={(e: any) => setIdAsignacion(e.target.value)}
        options={(data?.asignaciones ?? []).map((a) => ({ value: String(a.ID_ASIGNACION), label: `${a.DOCUMENTO} · ${a.CLIENTE} · ${a.COBRADOR}` }))}
        error={f.errors.idAsignacion}
        helperText={(data?.asignaciones.length ?? 0) === 0 ? 'No hay documentos asignados: asigna uno en la pestaña Documentos y mapa.' : 'Documento de la ruta al que corresponde la actividad.'} />
      <Select label="Actividad" required value={tipo} onChange={(e: any) => setTipo(e.target.value)} options={TIPOS_BITACORA}
        error={f.errors.tipo} helperText="Tipo de actividad realizada." />
    </div>
    <TextArea label="Observaciones" required maxLength={500} rows={3} value={observaciones}
      onChange={(e: any) => setObservaciones(e.target.value)} error={f.errors.observaciones ?? (observaciones ? validation.observaciones : undefined)}
      helperText="Detalle de lo ocurrido; máximo 500 caracteres." />
    {f.general && <p role="alert" className={formErrorClass}>{f.general}</p>}
    <FormActionButtons onCancel={onClose} isSubmitting={f.submitting} isFormValid={f.isFormValid}
      blockers={validation} createLabel="Guardar actividad" confirmTitle="Confirmar actividad"
      confirmMessage="¿Registrar esta actividad en la bitácora de la ruta?" />
  </form>;
}

function PerfilForm({ perfil, onSubmit, onCancel }: {
  perfil: CobradorPerfil;
  onSubmit: (payload: { telefono: string; fotoUrl: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [telefono, setTelefono] = useState(perfil.TELEFONO ?? '');
  const [fotoUrl, setFotoUrl] = useState(perfil.FOTO_URL ?? '');

  const validation: ValidationErrors = {};
  const telErr = telefono.trim() && !/^[0-9+()\-\s]{4,30}$/.test(telefono.trim())
    ? 'El teléfono solo admite números, espacios, +, - y paréntesis (4 a 30 caracteres).' : undefined;
  if (telErr) validation.telefono = telErr;
  if (fotoUrl.trim()) {
    let https = false;
    try { https = new URL(fotoUrl.trim()).protocol === 'https:'; } catch { https = false; }
    if (!https) validation.fotoUrl = 'La fotografía debe ser una URL válida que empiece con https://.';
    else if (fotoUrl.length > 1000) validation.fotoUrl = 'La URL no puede superar los 1000 caracteres.';
  }

  const f = useRutaForm(
    () => onSubmit({ telefono: telefono.trim(), fotoUrl: fotoUrl.trim() }),
    onCancel, validation, 'No se pudo guardar el perfil',
  );

  return <form onSubmit={f.handleSubmit} className="flex flex-col gap-4" noValidate>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Teléfono" maxLength={30} value={telefono} onChange={(e: any) => setTelefono(e.target.value)}
        error={f.errorFor('telefono', telefono)} placeholder="Ej. 2233-4455" helperText="Opcional; números, +, - y paréntesis." />
      <TextInput label="URL HTTPS de la fotografía" type="url" maxLength={1000} value={fotoUrl} onChange={(e: any) => setFotoUrl(e.target.value)}
        error={f.errorFor('fotoUrl', fotoUrl)} placeholder="https://..." helperText="Opcional; debe iniciar con https://." />
    </div>
    {f.general && <p role="alert" className={formErrorClass}>{f.general}</p>}
    <FormActionButtons onCancel={onCancel} isSubmitting={f.submitting} isEditing isFormValid={f.isFormValid}
      blockers={validation} editLabel="Guardar perfil" confirmTitle="Confirmar perfil"
      confirmMessage="¿Guardar el teléfono y la foto de este cobrador?" />
  </form>;
}

export function RutaOperacionPanel({ idRuta, estado }: { idRuta: number; estado: string }) {
  const [data, setData] = useState<RutaOperacion>();
  const [docs, setDocs] = useState<RutaDocumentoPendiente[]>([]);
  const [pagos, setPagos] = useState<RutaPagoDisponible[]>([]);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [perfil, setPerfil] = useState<CobradorPerfil>();
  const [tab, setTab] = useState<Tab>('documentos');
  const [modal, setModal] = useState<ModalKind>();
  const sending = useRef(false);
  const pendingOperation = useRef<{ fingerprint: string; clave: string }>();
  const closed = !['PLANIFICADA', 'EN_PROCESO'].includes(estado);

  async function load() {
    const [d, p, e, pagosData] = await Promise.all([
      apiClient.get<RutaOperacion>(`/cxc/rutas/${idRuta}/operacion`),
      apiClient.get<RutaDocumentoPendiente[]>('/cxc/rutas-documentos-pendientes'),
      apiClient.get<CatalogoOption[]>('/cxc/catalogos/empleados'),
      apiClient.get<RutaPagoDisponible[]>('/cxc/rutas-pagos-disponibles'),
    ]);
    setData(d); setDocs(p); setEmpleados(e); setPagos(pagosData);
  }
  function report(e: unknown) {
    if (e instanceof ApiError && Array.isArray(e.details)) {
      setError(e.details.map((v: { mensaje?: string }) => v.mensaje).filter(Boolean).join('. ') || e.message);
    } else setError(e instanceof Error ? e.message : 'No se pudo completar la operación');
  }
  useEffect(() => {
    setData(undefined); setSelected(undefined); setError('');
    load().catch(report);
  }, [idRuta]);

  /** Envía una operación; los errores vuelven al formulario que la pidió. */
  async function perform(action: () => Promise<void>) {
    if (sending.current) throw new Error('Ya hay una operación en curso; espera a que termine.');
    sending.current = true; setBusy(true); setError('');
    try {
      await action();
    } finally { sending.current = false; setBusy(false); }
    // Un fallo al refrescar tras una escritura exitosa no debe invitar a repetirla.
    try { await load(); } catch { setError('Se guardó la operación, pero no se actualizó la vista. Pulsa Actualizar antes de registrar otra.'); }
  }

  const punto = data?.asignaciones.find((a) => a.ID_ASIGNACION === selected) ?? data?.asignaciones[0];
  const mapPoints = useMemo(() => (data?.asignaciones ?? []).map((a) => ({
    id: a.ID_ASIGNACION, lat: a.LATITUD, lon: a.LONGITUD, orden: a.ORDEN_VISITA, label: `${a.ORDEN_VISITA}. ${a.CLIENTE} · ${a.DOCUMENTO}`,
  })), [data]);
  const totals = Object.values((data?.asignaciones ?? []).reduce<Record<string, { moneda: string; asignado: number; cobrado: number }>>((acc, a) => {
    const t = acc[a.ID_MONEDA] ?? { moneda: a.MONEDA, asignado: 0, cobrado: 0 };
    t.asignado += a.MONTO_ASIGNADO; t.cobrado += a.MONTO_REGISTRADO; acc[a.ID_MONEDA] = t; return acc;
  }, {}));
  const closeModal = () => setModal(undefined);

  return <section className="space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h2 className="text-xl font-bold text-slate-900">Control de cobranza de la ruta</h2><p className="text-sm text-slate-500">Documentos asignados, visitas y pagos aplicados.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} className="flex items-center gap-2 text-blue-700 px-2" onClick={() => { setError(''); load().catch(report); }}><RefreshCw size={16} /> Actualizar</button>
        {!closed && <>
          <Button variant="secondary" icon={Wallet} disabled={!data} onClick={() => setModal('cobro')}>Aplicar cobro</Button>
          <Button variant="secondary" icon={ClipboardList} disabled={!data} onClick={() => setModal('bitacora')}>Registrar actividad</Button>
          <Button icon={Plus} disabled={!data} onClick={() => setModal('asignar')}>Asignar documento</Button>
        </>}
      </div>
    </div>
    {error && <p role="alert" className={formErrorClass}>{error}</p>}
    {!data && !error && <p>Cargando operación de la ruta…</p>}
    {closed && <p className="bg-slate-100 text-slate-700 p-3 rounded-lg">Ruta cerrada: no se pueden asignar documentos, aplicar cobros ni registrar actividades. Puedes consultar su historial; las correcciones financieras se realizan mediante reversa en Aplicaciones de pago.</p>}
    <div className="grid md:grid-cols-2 gap-4">{totals.map((t) => <div key={t.moneda} className={card}><p className="text-sm font-bold text-slate-500">Resumen · {t.moneda}</p><div className="grid grid-cols-3 gap-3"><div><small>Asignado</small><p className="font-bold">{money(t.asignado)}</p></div><div><small>Cobrado aplicado</small><p className="font-bold text-emerald-700">{money(t.cobrado)}</p></div><div><small>Restante asignado</small><p className="font-bold">{money(t.asignado - t.cobrado)}</p></div></div></div>)}</div>
    <div className="grid md:grid-cols-2 gap-4">{data?.cobradores.map((p) => <article key={p.ID_EMPLEADO} className="bg-white border rounded-xl p-4 flex gap-4">
      {p.FOTO_URL && /^https:\/\//i.test(p.FOTO_URL) ? <img key={p.FOTO_URL} src={p.FOTO_URL} alt={`Foto de ${p.NOMBRE}`} className="w-20 h-20 rounded-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <span className="bg-blue-100 text-blue-700 rounded-full w-16 h-16 shrink-0 flex items-center justify-center"><UserRound /></span>}
      <div><h3 className="font-bold">{p.NOMBRE}</h3><p className="text-sm">{p.PUESTO || 'Empleado'} · {p.TELEFONO || 'Sin teléfono'}</p><p className="text-sm text-slate-500">{p.EMAIL}</p><button type="button" className="text-blue-600 text-sm" onClick={() => setPerfil(p)}>Editar teléfono y foto</button></div></article>)}</div>

    <div className="flex gap-2 border-b overflow-x-auto" role="tablist" aria-label="Operación de ruta">{([{ id: 'documentos', label: 'Documentos y mapa', icon: MapPin }, { id: 'bitacora', label: 'Bitácora', icon: ClipboardList }] as const).map((t) => <button type="button" key={t.id} role="tab" aria-selected={tab === t.id} className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap ${tab === t.id ? 'text-blue-700 border-b-2 border-blue-600 font-bold' : 'text-slate-500'}`} onClick={() => setTab(t.id)}><t.icon size={17} />{t.label}</button>)}</div>

    {tab === 'documentos' && <>
      <div className={card}><h3 className="font-bold">Mapa de las visitas</h3>{punto ? <>
        <Select label="Ubicación del documento" value={String(punto.ID_ASIGNACION)} onChange={(e: any) => setSelected(Number(e.target.value))} placeholder=""
          options={(data?.asignaciones ?? []).map((a) => ({ value: String(a.ID_ASIGNACION), label: `${a.ORDEN_VISITA}. ${a.CLIENTE} · ${a.DOCUMENTO} · ${a.DIRECCION}` }))} helperText="Elige una visita o haz clic en su marcador del mapa." />
        <RutaMap points={mapPoints} selectedId={punto.ID_ASIGNACION} onSelect={setSelected} />
        <a className="text-blue-600 text-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${punto.LATITUD},${punto.LONGITUD}`} target="_blank" rel="noreferrer">Abrir indicaciones para llegar</a></> : <p className="text-slate-500">Todavía no hay documentos con ubicación. Usa «Asignar documento» para agregar el primero y verlo en el mapa.</p>}</div>
      <div className="overflow-x-auto bg-white border rounded-xl"><table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr>{['Documento / cliente', 'Cobrador', 'Asignado', 'Cobrado aplicado', 'Restante asignado', 'Saldo actual documento', 'Avance / visita'].map((h) => <th className="p-3 whitespace-nowrap" key={h}>{h}</th>)}</tr></thead><tbody>{data?.asignaciones.map((a) => <tr key={a.ID_ASIGNACION} className="border-t"><td className="p-3">{a.DOCUMENTO}<br /><span className="text-slate-500">{a.CLIENTE}</span></td><td className="p-3">{a.COBRADOR}</td><td className="p-3">{a.MONEDA} {money(a.MONTO_ASIGNADO)}</td><td className="p-3 text-emerald-700">{money(a.MONTO_REGISTRADO)}</td><td className="p-3">{money(a.MONTO_ASIGNADO - a.MONTO_REGISTRADO)}</td><td className="p-3">{money(a.SALDO_DOCUMENTO)}</td><td className="p-3">{(100 * a.MONTO_REGISTRADO / a.MONTO_ASIGNADO).toFixed(1)}%<br />{a.ESTADO_VISITA}</td></tr>)}</tbody></table>{data?.asignaciones.length === 0 && <p className="p-4 text-slate-500">Sin documentos asignados.</p>}</div>
    </>}

    {tab === 'bitacora' && <div className={card}><h3 className="font-bold">Historial de la ruta</h3>{data?.bitacora.length === 0 && <p className="text-slate-500">Sin actividades registradas.</p>}{data?.bitacora.map((b) => <article key={`${b.TIPO}-${b.ID_BITACORA}`} className={`border-l-4 ${b.ESTADO === 'REVERSADA' ? 'border-amber-400' : 'border-blue-400'} pl-3 space-y-1`}><p className="font-semibold">{b.TIPO} · {b.FECHA}{b.ESTADO ? ` · ${b.ESTADO}` : ''}</p><p className="text-sm">{b.DOCUMENTO} · Cobrador: {b.COBRADOR}{b.MONTO != null ? ` · ${b.MONEDA} ${money(b.MONTO)}` : ''}</p><p className="text-sm">{b.OBSERVACIONES}</p>{b.TIPO === 'COBRO' && <p className="text-xs text-slate-500">Aplicación #{b.ID_BITACORA} · Registró: {b.REGISTRADO_POR || '—'} · Referencia: {b.REFERENCIA || '—'}</p>}</article>)}</div>}

    {modal === 'asignar' && <Modal isOpen onClose={closeModal} title="Asignar documento pendiente" description="Asigna un documento con saldo a esta ruta, con su cobrador y ubicación." size="lg" closeOnBackdrop={false}>
      <AsignacionForm data={data} docs={docs} empleados={empleados} onClose={closeModal}
        onSubmit={(payload) => perform(() => apiClient.post(`/cxc/rutas/${idRuta}/asignaciones`, payload).then(() => undefined))} />
    </Modal>}
    {modal === 'cobro' && <Modal isOpen onClose={closeModal} title="Aplicar cobro" description="Aplica un pago ya registrado a un documento de la ruta; reduce su saldo y genera el recibo." size="md" closeOnBackdrop={false}>
      <p className="text-sm text-slate-600 mb-4">Primero registra el dinero recibido en <Link className="text-blue-700 underline" to="/cxc/pagos/pagos" target="_blank">Pagos</Link> y pulsa Actualizar. Para corregir un cobro usa la reversa en <Link className="text-blue-700 underline" to="/cxc/pagos/aplicaciones-pago" target="_blank">Aplicaciones de pago</Link>.</p>
      <CobroForm data={data} pagos={pagos} empleados={empleados} onClose={closeModal}
        onSubmit={(payload) => perform(async () => {
          const fingerprint = JSON.stringify(payload);
          if (pendingOperation.current?.fingerprint !== fingerprint) pendingOperation.current = { fingerprint, clave: crypto.randomUUID() };
          await apiClient.post(`/cxc/rutas/${idRuta}/cobros`, { ...payload, claveOperacion: pendingOperation.current.clave });
          pendingOperation.current = undefined;
        })} />
    </Modal>}
    {modal === 'bitacora' && <Modal isOpen onClose={closeModal} title="Registrar visita o incidencia" description="Deja constancia de lo ocurrido con un documento de la ruta." size="md" closeOnBackdrop={false}>
      <BitacoraForm data={data} onClose={closeModal}
        onSubmit={(payload) => perform(() => apiClient.post(`/cxc/rutas/${idRuta}/bitacora`, payload).then(() => undefined))} />
    </Modal>}
    {perfil && <Modal isOpen onClose={() => setPerfil(undefined)} title={`Perfil de ${perfil.NOMBRE}`} description="Teléfono y fotografía del cobrador." size="md" closeOnBackdrop={false}>
      <PerfilForm key={perfil.ID_EMPLEADO} perfil={perfil} onCancel={() => setPerfil(undefined)}
        onSubmit={(payload) => perform(() => apiClient.patch(`/cxc/cobradores/${perfil.ID_EMPLEADO}/perfil`, payload).then(() => undefined))} />
    </Modal>}
  </section>;
}
