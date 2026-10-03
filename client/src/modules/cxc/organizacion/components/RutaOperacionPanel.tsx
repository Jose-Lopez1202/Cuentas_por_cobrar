import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, UserRound, Wallet, ClipboardList, RefreshCw } from 'lucide-react';
import type { RutaOperacion, CobradorPerfil, RutaDocumentoPendiente, RutaPagoDisponible, CatalogoOption } from '@erp/contracts';
import { apiClient, ApiError } from '../../../../shared/api';
import { todayIso } from '../../../../shared/validation';

const field = 'border border-slate-300 rounded-lg px-3 py-2 w-full bg-white mt-1';
const action = 'bg-blue-600 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50';
const card = 'bg-white border border-slate-200 rounded-xl p-5 space-y-4';
const money = (value: number) => Number(value).toLocaleString('es-GT', {minimumFractionDigits: 2, maximumFractionDigits: 2});
type Tab = 'documentos' | 'cobro' | 'bitacora';

export function RutaOperacionPanel({ idRuta, estado }: { idRuta: number; estado: string }) {
  const [data, setData] = useState<RutaOperacion>();
  const [docs, setDocs] = useState<RutaDocumentoPendiente[]>([]);
  const [pagos, setPagos] = useState<RutaPagoDisponible[]>([]);
  const [empleados, setEmpleados] = useState<CatalogoOption[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number>();
  const [cobroDetalle, setCobroDetalle] = useState('');
  const [perfil, setPerfil] = useState<CobradorPerfil>();
  const [tab, setTab] = useState<Tab>('documentos');
  const sending = useRef(false);
  const pendingOperation = useRef<{fingerprint: string; clave: string}>();
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
      setError(e.details.map((v: {mensaje?: string}) => v.mensaje).filter(Boolean).join('. ') || e.message);
    } else setError(e instanceof Error ? e.message : 'No se pudo completar la operación');
  }
  useEffect(() => {
    setData(undefined); setSelected(undefined); setCobroDetalle(''); setError('');
    load().catch(report);
  }, [idRuta]);

  async function submit(event: FormEvent<HTMLFormElement>, kind: 'asignacion' | 'bitacora' | 'perfil' | 'cobro') {
    event.preventDefault();
    if (sending.current) return;
    const form = event.currentTarget;
    const f = new FormData(form);
    const v = (key: string) => String(f.get(key) ?? '');
    sending.current = true; setBusy(true); setError('');
    try {
      if (kind === 'asignacion') await apiClient.post(`/cxc/rutas/${idRuta}/asignaciones`, {
        idDocumento: Number(v('documento')), idEmpleado: Number(v('empleado')), montoAsignado: Number(v('monto')),
        direccion: v('direccion'), latitud: Number(v('latitud')), longitud: Number(v('longitud')), ordenVisita: Number(v('orden')),
      });
      if (kind === 'bitacora') await apiClient.post(`/cxc/rutas/${idRuta}/bitacora`, {
        idAsignacion: Number(v('asignacion')), tipo: v('tipo'), observaciones: v('observaciones'),
      });
      if (kind === 'perfil') {
        await apiClient.patch(`/cxc/cobradores/${perfil!.ID_EMPLEADO}/perfil`, {telefono: v('telefono'), fotoUrl: v('foto')});
        setPerfil(undefined);
      }
      if (kind === 'cobro') {
        const payload = {idAsignacion: Number(v('asignacion')), idPago: Number(v('pago')), idEmpleado: Number(v('registrador')), monto: Number(v('monto')), fecha: v('fecha')};
        const fingerprint = JSON.stringify(payload);
        if (pendingOperation.current?.fingerprint !== fingerprint) pendingOperation.current = {fingerprint, clave: crypto.randomUUID()};
        await apiClient.post(`/cxc/rutas/${idRuta}/cobros`, {...payload, claveOperacion: pendingOperation.current.clave});
        pendingOperation.current = undefined;
        setCobroDetalle('');
      }
      form.reset();
      // A failed refresh after a successful write must not invite a second payment.
      try { await load(); } catch {setError('Se guardó la operación, pero no se actualizó la vista. Pulsa Actualizar antes de registrar otra.');}
    } catch (e) { report(e); } finally {sending.current = false; setBusy(false);}
  }
  const punto = data?.asignaciones.find(a => a.ID_ASIGNACION === selected) ?? data?.asignaciones[0];
  const cobro = data?.asignaciones.find(a => a.ID_ASIGNACION === Number(cobroDetalle));
  const pagosCliente = pagos.filter(p => p.ID_CLIENTE === cobro?.ID_CLIENTE && p.ID_MONEDA === cobro?.ID_MONEDA);
  const totals = Object.values((data?.asignaciones ?? []).reduce<Record<string, {moneda: string; asignado: number; cobrado: number}>>((acc, a) => {
    const t = acc[a.ID_MONEDA] ?? {moneda: a.MONEDA, asignado: 0, cobrado: 0};
    t.asignado += a.MONTO_ASIGNADO; t.cobrado += a.MONTO_REGISTRADO; acc[a.ID_MONEDA] = t; return acc;
  }, {}));
  const asignacionesOptions = data?.asignaciones.map(a => <option value={a.ID_ASIGNACION} key={a.ID_ASIGNACION}>{a.DOCUMENTO} · {a.CLIENTE} · {a.COBRADOR}</option>);

  return <section className="space-y-5">
    <div className="flex justify-between items-center gap-3"><div><h2 className="text-xl font-bold text-slate-900">Control de cobranza de la ruta</h2><p className="text-sm text-slate-500">Documentos asignados, visitas y pagos aplicados.</p></div>
      <button type="button" disabled={busy} className="flex items-center gap-2 text-blue-700" onClick={() => {setError('');load().catch(report);}}><RefreshCw size={16}/> Actualizar</button></div>
    {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</p>}
    {!data && !error && <p>Cargando operación de la ruta…</p>}
    {closed && <p className="bg-slate-100 text-slate-700 p-3 rounded-lg">Ruta cerrada. Puedes consultar su historial; las correcciones financieras se realizan mediante reversa en Aplicaciones de pago.</p>}
    <div className="grid md:grid-cols-2 gap-4">{totals.map(t => <div key={t.moneda} className={card}><p className="text-sm font-bold text-slate-500">Resumen · {t.moneda}</p><div className="grid grid-cols-3 gap-3"><div><small>Asignado</small><p className="font-bold">{money(t.asignado)}</p></div><div><small>Cobrado aplicado</small><p className="font-bold text-emerald-700">{money(t.cobrado)}</p></div><div><small>Restante asignado</small><p className="font-bold">{money(t.asignado - t.cobrado)}</p></div></div></div>)}</div>
    <div className="grid md:grid-cols-2 gap-4">{data?.cobradores.map(p => <article key={p.ID_EMPLEADO} className="bg-white border rounded-xl p-4 flex gap-4">
      {p.FOTO_URL && /^https:\/\//i.test(p.FOTO_URL) ? <img key={p.FOTO_URL} src={p.FOTO_URL} alt={`Foto de ${p.NOMBRE}`} className="w-20 h-20 rounded-full object-cover" referrerPolicy="no-referrer" onError={e => {e.currentTarget.style.display='none';}}/> : <span className="bg-blue-100 text-blue-700 rounded-full w-16 h-16 shrink-0 flex items-center justify-center"><UserRound/></span>}
      <div><h3 className="font-bold">{p.NOMBRE}</h3><p className="text-sm">{p.PUESTO || 'Empleado'} · {p.TELEFONO || 'Sin teléfono'}</p><p className="text-sm text-slate-500">{p.EMAIL}</p><button className="text-blue-600 text-sm" onClick={() => setPerfil(p)}>Editar teléfono y foto</button></div></article>)}</div>
    {perfil && <form key={perfil.ID_EMPLEADO} onSubmit={e => submit(e, 'perfil')} className={card}><h3 className="font-bold">Perfil de {perfil.NOMBRE}</h3><label className="block">Teléfono<input name="telefono" maxLength={30} defaultValue={perfil.TELEFONO ?? ''} className={field}/></label><label className="block">URL HTTPS de la fotografía<input name="foto" type="url" maxLength={1000} defaultValue={perfil.FOTO_URL ?? ''} className={field}/></label><button disabled={busy} className={action}>Guardar perfil</button> <button type="button" onClick={() => setPerfil(undefined)}>Cerrar</button></form>}
    <div className="flex gap-2 border-b overflow-x-auto" role="tablist" aria-label="Operación de ruta">{([{id:'documentos',label:'Documentos y mapa',icon:MapPin},{id:'cobro',label:'Aplicar cobro',icon:Wallet},{id:'bitacora',label:'Bitácora',icon:ClipboardList}] as const).map(t => <button key={t.id} role="tab" aria-selected={tab===t.id} className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap ${tab===t.id?'text-blue-700 border-b-2 border-blue-600 font-bold':'text-slate-500'}`} onClick={() => setTab(t.id)}><t.icon size={17}/>{t.label}</button>)}</div>
    {tab === 'documentos' && <>
      <div className={card}><h3 className="font-bold">Mapa de las visitas</h3>{punto ? <><select aria-label="Ubicación del documento" className={field} value={punto.ID_ASIGNACION} onChange={e => setSelected(Number(e.target.value))}>{data?.asignaciones.map(a => <option key={a.ID_ASIGNACION} value={a.ID_ASIGNACION}>{a.ORDEN_VISITA}. {a.CLIENTE} · {a.DOCUMENTO} · {a.DIRECCION}</option>)}</select>
        <iframe title="Ubicación de visita en OpenStreetMap" className="w-full h-72 rounded-lg border" loading="lazy" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.max(-180,punto.LONGITUD-.01)}%2C${Math.max(-90,punto.LATITUD-.01)}%2C${Math.min(180,punto.LONGITUD+.01)}%2C${Math.min(90,punto.LATITUD+.01)}&layer=mapnik&marker=${punto.LATITUD}%2C${punto.LONGITUD}`}/>
        <a className="text-blue-600" href={`https://www.google.com/maps/dir/?api=1&destination=${punto.LATITUD},${punto.LONGITUD}`} target="_blank" rel="noreferrer">Abrir indicaciones para llegar</a></> : <p className="text-slate-500">Asigna un documento con su ubicación para verlo en el mapa.</p>}</div>
      {!closed && <form onSubmit={e => submit(e, 'asignacion')} className={`${card} grid md:grid-cols-2 gap-3`}><h3 className="md:col-span-2 font-bold">Asignar documento pendiente</h3>
        <label>Documento<select className={field} name="documento" required><option value="">Seleccionar</option>{docs.filter(d => d.DISPONIBLE>0 && !data?.asignaciones.some(a => a.ID_DOCUMENTO===d.ID_DOCUMENTO)).map(d => <option value={d.ID_DOCUMENTO} key={d.ID_DOCUMENTO}>{d.DOCUMENTO} · {d.CLIENTE} · disponible {d.MONEDA} {money(d.DISPONIBLE)}</option>)}</select></label>
        <label>Cobrador<select className={field} name="empleado" required><option value="">Seleccionar</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
        <label>Monto asignado<input className={field} name="monto" type="number" min="0.01" step="0.01" required/></label><label>Orden de visita<input className={field} name="orden" type="number" min="1" step="1" defaultValue={(data?.asignaciones.length ?? 0)+1} required/></label>
        <label className="md:col-span-2">Dirección<input className={field} name="direccion" maxLength={250} required/></label>
        <label>Latitud<input className={field} name="latitud" type="number" min="-90" max="90" step="any" placeholder="Ej. 14.6349" required/></label><label>Longitud<input className={field} name="longitud" type="number" min="-180" max="180" step="any" placeholder="Ej. -90.5069" required/></label>
        <button disabled={busy || !data} className={action}>Asignar documento</button></form>}
      <div className="overflow-x-auto bg-white border rounded-xl"><table className="w-full text-sm text-left"><thead className="bg-slate-50"><tr>{['Documento / cliente','Cobrador','Asignado','Cobrado aplicado','Restante asignado','Saldo actual documento','Avance / visita'].map(h => <th className="p-3 whitespace-nowrap" key={h}>{h}</th>)}</tr></thead><tbody>{data?.asignaciones.map(a => <tr key={a.ID_ASIGNACION} className="border-t"><td className="p-3">{a.DOCUMENTO}<br/><span className="text-slate-500">{a.CLIENTE}</span></td><td className="p-3">{a.COBRADOR}</td><td className="p-3">{a.MONEDA} {money(a.MONTO_ASIGNADO)}</td><td className="p-3 text-emerald-700">{money(a.MONTO_REGISTRADO)}</td><td className="p-3">{money(a.MONTO_ASIGNADO-a.MONTO_REGISTRADO)}</td><td className="p-3">{money(a.SALDO_DOCUMENTO)}</td><td className="p-3">{(100*a.MONTO_REGISTRADO/a.MONTO_ASIGNADO).toFixed(1)}%<br/>{a.ESTADO_VISITA}</td></tr>)}</tbody></table>{data?.asignaciones.length===0 && <p className="p-4 text-slate-500">Sin documentos asignados.</p>}</div>
    </>}
    {tab === 'cobro' && <div className={card}><h3 className="font-bold">Aplicar un pago al documento de la ruta</h3><p className="text-sm text-slate-600">Primero registra el dinero recibido en <Link className="text-blue-700 underline" to="/cxc/pagos/pagos" target="_blank">Pagos</Link>. Después pulsa Actualizar y selecciónalo aquí. Esta operación reduce el saldo del documento y genera el recibo del importe aplicado.</p>
      {!closed && <form onSubmit={e => submit(e, 'cobro')} className="grid md:grid-cols-2 gap-4">
        <label className="md:col-span-2">Documento asignado<select name="asignacion" className={field} required value={cobroDetalle} onChange={e => setCobroDetalle(e.target.value)}><option value="">Seleccionar documento</option>{asignacionesOptions}</select></label>
        {cobro && <p className="md:col-span-2 text-sm bg-blue-50 p-3 rounded-lg">Cobrador: {cobro.COBRADOR} · Restante asignado: {cobro.MONEDA} {money(cobro.MONTO_ASIGNADO-cobro.MONTO_REGISTRADO)} · Saldo del documento: {money(cobro.SALDO_DOCUMENTO)}</p>}
        <label>Pago disponible<select key={cobroDetalle} name="pago" className={field} required><option value="">Seleccionar pago</option>{pagosCliente.map(p => <option key={p.ID_PAGO} value={p.ID_PAGO}>{p.REFERENCIA} · {p.MONEDA} {money(p.DISPONIBLE)}</option>)}</select></label>
        <label>Empleado que registra<select name="registrador" className={field} required><option value="">Seleccionar</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
        {cobro && pagosCliente.length===0 && <p className="md:col-span-2 text-amber-700 text-sm">No hay pagos disponibles de este cliente y moneda. Registra uno en Pagos y actualiza la vista.</p>}
        <label>Monto a aplicar<input name="monto" className={field} type="number" min="0.01" step="0.01" required max={cobro ? Math.max(0,Math.min(cobro.MONTO_ASIGNADO-cobro.MONTO_REGISTRADO,cobro.SALDO_DOCUMENTO)) : undefined}/></label>
        <label>Fecha de aplicación<input name="fecha" type="date" className={field} defaultValue={todayIso()} max={todayIso()} required/></label>
        <button className={action} disabled={busy || !cobro || pagosCliente.length===0}>Aplicar cobro y generar recibo</button>
      </form>}
      <p className="text-sm">Para corregir un cobro, utiliza <Link className="text-blue-700 underline" to="/cxc/pagos/aplicaciones-pago" target="_blank">Aplicaciones de pago</Link> y registra la reversa. Luego actualiza esta vista.</p>
    </div>}
    {tab === 'bitacora' && <>
      {!closed && <form onSubmit={e => submit(e, 'bitacora')} className={`${card} grid md:grid-cols-2 gap-3`}><h3 className="md:col-span-2 font-bold">Registrar visita o incidencia</h3>
        <label>Documento asignado<select name="asignacion" className={field} required><option value="">Seleccionar</option>{asignacionesOptions}</select></label>
        <label>Actividad<select name="tipo" className={field}><option value="VISITA">Visita realizada</option><option value="INCIDENCIA">Incidencia</option><option value="REPROGRAMACION">Reprogramación</option></select></label>
        <label className="md:col-span-2">Observaciones<textarea className={field} name="observaciones" maxLength={500} required/></label><button className={action} disabled={busy || !data?.asignaciones.length}>Guardar actividad</button></form>}
      <div className={card}><h3 className="font-bold">Historial de la ruta</h3>{data?.bitacora.length===0 && <p className="text-slate-500">Sin actividades registradas.</p>}{data?.bitacora.map(b => <article key={`${b.TIPO}-${b.ID_BITACORA}`} className={`border-l-4 ${b.ESTADO==='REVERSADA'?'border-amber-400':'border-blue-400'} pl-3 space-y-1`}><p className="font-semibold">{b.TIPO} · {b.FECHA}{b.ESTADO ? ` · ${b.ESTADO}` : ''}</p><p className="text-sm">{b.DOCUMENTO} · Cobrador: {b.COBRADOR}{b.MONTO != null ? ` · ${b.MONEDA} ${money(b.MONTO)}` : ''}</p><p className="text-sm">{b.OBSERVACIONES}</p>{b.TIPO==='COBRO' && <p className="text-xs text-slate-500">Aplicación #{b.ID_BITACORA} · Registró: {b.REGISTRADO_POR || '—'} · Referencia: {b.REFERENCIA || '—'}</p>}</article>)}</div>
    </>}
  </section>;
}
