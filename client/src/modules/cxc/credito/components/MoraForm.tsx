import React, { useEffect, useMemo, useState } from 'react';
import { TextInput, Select } from '../../../../shared/ui-kit';
import { FormActionButtons } from '../../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../../shared/api';
import {
  hasErrors,
  todayIso,
  validateDate,
  validateMoney,
  validateNumber,
  validatePercentage,
  validateRequiredSelect,
  type ValidationErrors,
} from '../../../../shared/validation';
import type { CatalogoOption, Mora } from '@erp/contracts';

const ESTADO_OPTIONS = [
  { value: 'ACTIVA', label: 'Activa' },
  { value: 'PAGADA', label: 'Pagada' },
  { value: 'ANULADA', label: 'Anulada' },
];
interface MoraFormProps { mora?: Mora | null; onSuccess: () => void; onCancel: () => void; }

export const MoraForm = ({ mora, onSuccess, onCancel }: MoraFormProps) => {
  const isEditing = !!mora;
  const [clientes, setClientes] = useState<CatalogoOption[]>([]);
  const [documentos, setDocumentos] = useState<CatalogoOption[]>([]);
  const [idCliente, setIdCliente] = useState('');
  const [idDocumento, setIdDocumento] = useState(mora?.idDocumento?.toString() ?? '');
  const [diasMora, setDiasMora] = useState(mora?.diasMora?.toString() ?? '');
  const [saldoVencido, setSaldoVencido] = useState(mora?.saldoVencido?.toString() ?? '');
  const [porcentajeMora, setPorcentajeMora] = useState(mora?.porcentajeMora?.toString() ?? '');
  const [montoMora, setMontoMora] = useState(mora?.montoMora?.toString() ?? '');
  const [fechaCalculo, setFechaCalculo] = useState(mora?.fechaCalculo?.slice(0, 10) ?? todayIso());
  const [estado, setEstado] = useState(mora?.estado ?? 'ACTIVA');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { apiClient.get<CatalogoOption[]>('/cxc/catalogos/clientes').then(setClientes).catch(()=>setClientes([])); }, []);
  useEffect(() => {
    if (!idCliente) { if (!isEditing) { setDocumentos([]); setIdDocumento(''); } return; }
    apiClient.get<CatalogoOption[]>(`/cxc/catalogos/clientes/${idCliente}/documentos-pendientes`).then(setDocumentos).catch(()=>setDocumentos([]));
  }, [idCliente, isEditing]);

  const validate = (): ValidationErrors => {
    const next: ValidationErrors = {};
    if (!isEditing) { const c = validateRequiredSelect(idCliente, 'un cliente'); if (c) next.idCliente = c; }
    const d = validateRequiredSelect(idDocumento, 'un documento'); if (d) next.idDocumento = d;
    const dm = validateNumber(diasMora, 'Los días de mora', { integer:true, min:0, max:36500 }); if (dm) next.diasMora = dm;
    const sv = validateMoney(saldoVencido, 'El saldo vencido', { min:0 }); if (sv) next.saldoVencido = sv;
    const pm = validatePercentage(porcentajeMora, 'El porcentaje de mora', { decimalPlaces:4 }); if (pm) next.porcentajeMora = pm;
    const mm = validateMoney(montoMora, 'El monto de mora', { min:0 }); if (mm) next.montoMora = mm;
    const fc = validateDate(fechaCalculo, 'La fecha de cálculo', { notFuture:true }); if (fc) next.fechaCalculo = fc;
    return next;
  };
  const isFormValid = useMemo(() => !hasErrors(validate()), [isEditing,idCliente,idDocumento,diasMora,saldoVencido,porcentajeMora,montoMora,fechaCalculo,estado]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); const validationErrors = validate(); if (hasErrors(validationErrors)) { setErrors(validationErrors); return; }
    setErrors({}); setFormError(null); setIsSubmitting(true);
    const payload = { idDocumento:Number(idDocumento), diasMora:diasMora!==''?Number(diasMora):null, saldoVencido:saldoVencido!==''?Number(saldoVencido):null, porcentajeMora:porcentajeMora!==''?Number(porcentajeMora):null, montoMora:montoMora!==''?Number(montoMora):null, fechaCalculo:fechaCalculo||null, estado };
    try { if (isEditing) await apiClient.patch(`/cxc/mora/${mora!.idMora}`,payload); else await apiClient.post('/cxc/mora',payload); onSuccess(); }
    catch(err){ if(err instanceof ApiError&&err.status===400&&Array.isArray(err.details)){const fe:ValidationErrors={};(err.details as Array<{campo:string;mensaje:string}>).forEach(x=>fe[x.campo]=x.mensaje);setErrors(fe);}else setFormError(err instanceof ApiError?err.message:'No se pudo guardar el registro de mora'); }
    finally{setIsSubmitting(false);}
  };

  return <form onSubmit={handleSubmit} className="flex flex-col gap-4">
    {!isEditing && <Select label="Cliente" required value={idCliente} onChange={(e:any)=>{setIdCliente(e.target.value);setIdDocumento('');}} options={clientes.map(c=>({value:c.id,label:c.label}))} placeholder="Seleccionar cliente" error={errors.idCliente} helperText="Primero selecciona el cliente para mostrar únicamente sus documentos pendientes." />}
    {isEditing ? <TextInput label="Documento" value={idDocumento} isReadOnly helperText="El documento asociado no se cambia durante la edición de la mora." /> : <Select label="Documento" required value={idDocumento} onChange={(e:any)=>setIdDocumento(e.target.value)} options={documentos.map(d=>({value:d.id,label:d.label}))} placeholder={idCliente?'Seleccionar documento':'Selecciona un cliente primero'} isReadOnly={!idCliente} error={errors.idDocumento} helperText="Documento con saldo pendiente al que corresponde la mora." />}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Días de mora" type="number" restriction="integer" min="0" max="36500" value={diasMora} onChange={(e:any)=>setDiasMora(e.target.value)} error={errors.diasMora} placeholder="0" helperText="Solo enteros no negativos." />
      <TextInput label="Saldo vencido" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0" value={saldoVencido} onChange={(e:any)=>setSaldoVencido(e.target.value)} error={errors.saldoVencido} placeholder="0.00" helperText="Monto vencido, máximo 2 decimales." />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Porcentaje de mora" type="number" restriction="decimal" decimalPlaces={4} step="0.0001" min="0" max="100" value={porcentajeMora} onChange={(e:any)=>setPorcentajeMora(e.target.value)} error={errors.porcentajeMora} placeholder="0.0000" helperText="Porcentaje entre 0 y 100, máximo 4 decimales." />
      <TextInput label="Monto de mora" type="number" restriction="decimal" decimalPlaces={2} step="0.01" min="0" value={montoMora} onChange={(e:any)=>setMontoMora(e.target.value)} error={errors.montoMora} placeholder="0.00" helperText="Importe calculado de mora, máximo 2 decimales." />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TextInput label="Fecha de cálculo" type="date" max={todayIso()} value={fechaCalculo} onChange={(e:any)=>setFechaCalculo(e.target.value)} error={errors.fechaCalculo} helperText="No puede ser posterior a hoy." />
      <Select label="Estado" required value={estado} onChange={(e:any)=>setEstado(e.target.value)} options={ESTADO_OPTIONS} error={errors.estado} helperText="Estado controlado del registro de mora." />
    </div>
    {formError && <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
    <FormActionButtons onCancel={onCancel} isSubmitting={isSubmitting} isEditing={isEditing} createLabel="Crear mora" isFormValid={isFormValid} />
  </form>;
};
