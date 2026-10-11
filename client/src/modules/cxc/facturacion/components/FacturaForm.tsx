import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Plus, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { TextInput, Select, Button } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import { moneyGT } from '../../../../shared/csv';
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
import type { DocumentoCatalogoOption, FacturaFelDetalle, ValidacionSat } from '@erp/contracts';

interface FacturaFormProps {
  onSuccess: (factura: FacturaFelDetalle) => void;
  onCancel: () => void;
}

interface LineaState { descripcion: string; cantidad: string; precioUnitario: string }
const nuevaLinea = (): LineaState => ({ descripcion: '', cantidad: '1', precioUnitario: '' });
// Mismo valor que IVA_GT de @erp/contracts (el bundle CJS de contracts no expone constantes nuevas a Vite).
const IVA_GT = 0.12;
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export const FacturaForm = ({ onSuccess, onCancel }: FacturaFormProps) => {
  const [clientes, setClientes] = useState<DocumentoCatalogoOption[]>([]);
  const [monedas, setMonedas] = useState<DocumentoCatalogoOption[]>([]);
  const [condiciones, setCondiciones] = useState<DocumentoCatalogoOption[]>([]);
  const [empleados, setEmpleados] = useState<DocumentoCatalogoOption[]>([]);

  const [idCliente, setIdCliente] = useState('');
  const [nitReceptor, setNitReceptor] = useState('');
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [idMoneda, setIdMoneda] = useState('');
  const [idCondicion, setIdCondicion] = useState('');
  const [fechaEmision, setFechaEmision] = useState(todayIso());
  const [idEmpleado, setIdEmpleado] = useState('');
  const [lineas, setLineas] = useState<LineaState[]>([nuevaLinea()]);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validando, setValidando] = useState(false);
  const [resultadoSat, setResultadoSat] = useState<ValidacionSat | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/clientes'),
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/monedas'),
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/condiciones-credito'),
      apiClient.get<DocumentoCatalogoOption[]>('/cxc/documentos/catalogos/empleados'),
    ]).then(([c, m, cc, e]) => {
      setClientes(c); setMonedas(m); setCondiciones(cc); setEmpleados(e);
      if (m.length === 1) setIdMoneda(String(m[0].id));
    }).catch(() => setFormError('No se pudieron cargar los catálogos. Cierra y vuelve a abrir el formulario.'));
  }, []);

  const handleCliente = (value: string) => {
    setIdCliente(value);
    const cliente = clientes.find((c) => String(c.id) === value);
    setNitReceptor(cliente?.nit?.trim() || 'CF');
    setNombreReceptor(cliente?.label ?? '');
    setResultadoSat(null);
  };

  const totales = useMemo(() => {
    const total = round2(lineas.reduce((acc, l) => {
      const cant = Number(l.cantidad); const precio = Number(l.precioUnitario);
      return acc + (Number.isFinite(cant) && Number.isFinite(precio) ? round2(cant * precio) : 0);
    }, 0));
    const base = round2(total / (1 + IVA_GT));
    return { total, base, iva: round2(total - base) };
  }, [lineas]);

  const validation = useMemo<ValidationErrors>(() => {
    const next: ValidationErrors = {};
    const set = (key: string, msg: string | undefined) => { if (msg) next[key] = msg; };
    set('idCliente', validateRequiredSelect(idCliente, 'un cliente'));
    set('nitReceptor', validateRequired(nitReceptor, 'El NIT del receptor') ?? validateMaxLength(nitReceptor, 'El NIT', 20));
    set('nombreReceptor', validateRequired(nombreReceptor, 'El nombre del receptor') ?? validateMaxLength(nombreReceptor, 'El nombre', 150));
    set('idMoneda', validateRequiredSelect(idMoneda, 'una moneda'));
    set('fechaEmision', validateRequiredDate(fechaEmision, 'La fecha de emisión', { notFuture: true }));
    set('idEmpleado', validateRequiredSelect(idEmpleado, 'el empleado que emite'));
    lineas.forEach((l, i) => {
      const n = i + 1;
      set(`linea${i}.descripcion`, validateRequired(l.descripcion, `La descripción de la línea ${n}`) ?? validateMaxLength(l.descripcion, `La descripción de la línea ${n}`, 200));
      set(`linea${i}.cantidad`, validateRequiredNumber(l.cantidad, `La cantidad de la línea ${n}`, { positive: true, decimalPlaces: 4 }));
      set(`linea${i}.precioUnitario`, validateMoney(l.precioUnitario, `El precio de la línea ${n}`, { required: true, positive: true }));
    });
    return next;
  }, [idCliente, nitReceptor, nombreReceptor, idMoneda, fechaEmision, idEmpleado, lineas]);

  const isFormValid = !hasErrors(validation);
  const errorFor = (field: string, value: string) => errors[field] ?? (value ? validation[field] : undefined);

  const payload = () => ({
    idCliente: Number(idCliente),
    nitReceptor: nitReceptor.trim(),
    nombreReceptor: nombreReceptor.trim(),
    idMoneda: Number(idMoneda),
    idCondicionCredito: idCondicion ? Number(idCondicion) : null,
    fechaEmision,
    idEmpleado: Number(idEmpleado),
    lineas: lineas.map((l) => ({ descripcion: l.descripcion.trim(), cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario) })),
  });

  const mapError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
      const fields: ValidationErrors = {};
      const generales: string[] = [];
      (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => {
        if (['general', 'lineas', 'idCondicionCredito'].includes(d.campo) || !d.campo) generales.push(d.mensaje);
        else fields[d.campo] = d.mensaje;
      });
      setErrors(fields);
      setFormError(generales.length ? generales.join(' ') : null);
      return;
    }
    setFormError(err instanceof Error ? err.message : fallback);
  };

  const handleValidar = async () => {
    if (!isFormValid) { setErrors(validation); return; }
    setValidando(true); setFormError(null); setErrors({});
    try {
      setResultadoSat(await apiClient.post<ValidacionSat>('/cxc/facturas/validar', payload(), { successMessage: false }));
    } catch (err) { mapError(err, 'No se pudo consultar a la SAT simulada'); }
    finally { setValidando(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) { setErrors(validation); return; }
    setIsSubmitting(true); setFormError(null); setErrors({});
    try {
      const factura = await apiClient.post<FacturaFelDetalle>('/cxc/facturas', payload(), { successMessage: 'Factura certificada correctamente.' });
      onSuccess(factura);
    } catch (err) { mapError(err, 'No se pudo emitir la factura'); }
    finally { setIsSubmitting(false); }
  };

  const setLinea = (i: number, patch: Partial<LineaState>) => {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setResultadoSat(null);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Cliente" required value={idCliente} onChange={(e: any) => handleCliente(e.target.value)}
          options={clientes.map((c) => ({ value: String(c.id), label: c.nit ? `${c.label} — NIT ${c.nit}` : c.label }))}
          error={errors.idCliente} helperText="Receptor de la factura; su NIT y nombre se cargan solos." />
        <Select label="Empleado que emite" required value={idEmpleado} onChange={(e: any) => setIdEmpleado(e.target.value)}
          options={empleados.map((x) => ({ value: String(x.id), label: x.label }))} error={errors.idEmpleado}
          helperText="Queda registrado como emisor de la factura." />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput label="NIT del receptor" required uppercase maxLength={20} value={nitReceptor}
          onChange={(e: any) => { setNitReceptor(e.target.value); setResultadoSat(null); }}
          error={errorFor('nitReceptor', nitReceptor)} placeholder="Ej. 1234567-9 o CF"
          helperText="NIT con su dígito verificador, o CF para consumidor final (máx. Q2,500.00)." />
        <TextInput label="Nombre del receptor" required maxLength={150} value={nombreReceptor}
          onChange={(e: any) => { setNombreReceptor(e.target.value); setResultadoSat(null); }}
          error={errorFor('nombreReceptor', nombreReceptor)} helperText="Como debe aparecer en la factura." />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select label="Moneda" required value={idMoneda} onChange={(e: any) => setIdMoneda(e.target.value)}
          options={monedas.map((m) => ({ value: String(m.id), label: m.label }))} error={errors.idMoneda} />
        <Select label="Condición de crédito" value={idCondicion} onChange={(e: any) => { setIdCondicion(e.target.value); setResultadoSat(null); }}
          options={[{ value: '', label: 'Contado (vence el mismo día)' }, ...condiciones.map((c) => ({ value: String(c.id), label: c.label }))]}
          placeholder="" helperText="Define la fecha de vencimiento de la cuenta por cobrar." />
        <TextInput label="Fecha de emisión" type="date" required max={todayIso()} value={fechaEmision}
          onChange={(e: any) => { setFechaEmision(e.target.value); setResultadoSat(null); }}
          error={errorFor('fechaEmision', fechaEmision)} helperText="No puede ser una fecha futura." />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Detalle de la factura</h3>
          <Button type="button" variant="secondary" icon={Plus} onClick={() => setLineas((p) => [...p, nuevaLinea()])}>Agregar línea</Button>
        </div>
        {errors.lineas && <p role="alert" className="text-xs text-red-600 font-medium">{errors.lineas}</p>}
        {lineas.map((l, i) => {
          const totalLinea = round2((Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0));
          return (
            <div key={i} className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
              <div className="sm:col-span-5">
                <TextInput label="Descripción" required maxLength={200} value={l.descripcion}
                  onChange={(e: any) => setLinea(i, { descripcion: e.target.value })}
                  error={errors[`linea${i}.descripcion`] ?? (l.descripcion ? validation[`linea${i}.descripcion`] : undefined)} helperText="Bien o servicio facturado." />
              </div>
              <div className="sm:col-span-2">
                <TextInput label="Cantidad" type="number" restriction="decimal" decimalPlaces={4} step="0.0001" min="0.0001" required value={l.cantidad}
                  onChange={(e: any) => setLinea(i, { cantidad: e.target.value })}
                  error={errors[`linea${i}.cantidad`] ?? (l.cantidad ? validation[`linea${i}.cantidad`] : undefined)} helperText="Mayor a 0." />
              </div>
              <div className="sm:col-span-3">
                <TextInput label="Precio unitario (con IVA)" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0.01" required value={l.precioUnitario}
                  onChange={(e: any) => setLinea(i, { precioUnitario: e.target.value })}
                  error={errors[`linea${i}.precioUnitario`] ?? (l.precioUnitario ? validation[`linea${i}.precioUnitario`] : undefined)} helperText="Mayor a 0; IVA incluido." />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-700">Total línea</span>
                <div className="h-10 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{moneyGT(totalLinea)}</span>
                  <button type="button" disabled={lineas.length === 1} onClick={() => setLineas((p) => p.filter((_, idx) => idx !== i))}
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={lineas.length === 1 ? 'La factura necesita al menos una línea' : 'Quitar línea'} aria-label={`Quitar línea ${i + 1}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-slate-500">Base sin IVA</p><p className="font-bold">{moneyGT(totales.base)}</p></div>
        <div><p className="text-xs text-slate-500">IVA (12%)</p><p className="font-bold">{moneyGT(totales.iva)}</p></div>
        <div><p className="text-xs text-slate-500">Total a cobrar</p><p className="font-bold text-blue-700">{moneyGT(totales.total)}</p></div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Puedes revisar la factura contra las reglas de la SAT (simulada) antes de certificarla.</p>
          <Button type="button" variant="secondary" icon={ShieldCheck} disabled={validando || isSubmitting || !isFormValid} onClick={handleValidar}
            title={isFormValid ? 'Validar con la SAT simulada' : 'Completa los campos para poder validar'}>
            {validando ? 'Validando...' : 'Validar con la SAT'}
          </Button>
        </div>
        {resultadoSat && (
          <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${resultadoSat.valida ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
            <p className="flex items-center gap-1.5 font-semibold">
              {resultadoSat.valida ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {resultadoSat.valida ? 'La SAT (simulada) aprobaría esta factura.' : 'La SAT (simulada) rechazaría esta factura:'}
            </p>
            {resultadoSat.errores.length > 0 && (
              <ul className="mt-1 list-disc pl-5 space-y-0.5 text-xs">
                {resultadoSat.errores.map((e) => <li key={`${e.codigo}-${e.campo}`}><strong>{e.codigo}</strong>: {e.mensaje}</li>)}
              </ul>
            )}
            {resultadoSat.advertencias.map((a) => <p key={a} className="text-xs mt-1">⚠ {a}</p>)}
            {resultadoSat.valida && (
              <p className="text-xs mt-1">Emisor: {resultadoSat.nombreEmisor} (NIT {resultadoSat.nitEmisor}) · Receptor: {resultadoSat.nombreReceptor} (NIT {resultadoSat.nitReceptor}) · Vence: {resultadoSat.fechaVencimiento}</p>
            )}
          </div>
        )}
      </div>

      {formError && <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}

      <FormActionButtons onCancel={onCancel} isSubmitting={isSubmitting} isFormValid={isFormValid} blockers={validation}
        createLabel="Emitir y certificar" savingLabel="Certificando..."
        confirmTitle="Certificar factura"
        confirmMessage="Se certificará la factura (simulación SAT), se generará su UUID y se creará la cuenta por cobrar. ¿Continuar?"
        confirmLabel="Sí, certificar" />
    </form>
  );
};
