import { useCallback, useState, type ReactNode } from 'react';
import type { Cliente360, CobradorDetalle, DocumentoClienteDetalle, GestionDetalle, PagoAplicadoDetalle, RutaDetalleGrupo } from '@erp/contracts';
import { useApi } from '../useApi';
import { COLOR, Q, entero, fechaCorta, pct, variacion } from '../format';
import { Drawer, Pestanas } from '../ui/Drawer';
import { DataGrid, type Columna } from '../ui/DataGrid';
import { ErrorCaja, Esqueleto, Panel } from '../ui/Panel';
import { EstadoPill, Medidor, RiesgoPill, etiquetaEstado } from '../ui/Pills';
import { AreaSimple } from '../ui/charts';
import { Delta } from '../ui/KpiCard';
import { agruparSerie } from '../format';

/** Tipos de detalle que cualquier fila de cualquier tablero puede abrir. */
export type DetalleItem =
  | { tipo: 'cliente'; id: number; titulo?: string }
  | { tipo: 'cobrador'; id: number; titulo?: string }
  | { tipo: 'ruta'; base: string }
  | { tipo: 'pagos'; titulo: string; modo: 'semana' | 'mes' | 'fecha' | 'periodo'; valor: string | number };

export interface QueryDetalle { desde: string; hasta: string; idEmpleado?: number; idRuta?: number }

/** Pila de detalles: se puede entrar de un cobrador a un cliente y volver. */
export function useDetalle(query: QueryDetalle) {
  const [pila, setPila] = useState<DetalleItem[]>([]);
  const abrir = useCallback((item: DetalleItem) => setPila((p) => [...p, item]), []);
  const volver = useCallback(() => setPila((p) => p.slice(0, -1)), []);
  const cerrar = useCallback(() => setPila([]), []);
  const actual = pila[pila.length - 1];
  const host = actual ? <DetalleHost item={actual} query={query} onAbrir={abrir} onCerrar={cerrar} onVolver={pila.length > 1 ? volver : undefined} /> : null;
  return { abrir, host };
}

function DetalleHost({ item, query, onAbrir, onCerrar, onVolver }: {
  item: DetalleItem; query: QueryDetalle; onAbrir: (i: DetalleItem) => void; onCerrar: () => void; onVolver?: () => void;
}) {
  const sinCobrador = { desde: query.desde, hasta: query.hasta };
  if (item.tipo === 'cliente') return <ClienteDetalle id={item.id} q={sinCobrador} onAbrir={onAbrir} onCerrar={onCerrar} onVolver={onVolver} />;
  if (item.tipo === 'cobrador') return <CobradorDetalleView id={item.id} q={{ ...sinCobrador, idRuta: query.idRuta }} onAbrir={onAbrir} onCerrar={onCerrar} onVolver={onVolver} />;
  if (item.tipo === 'ruta') return <RutaDetalleView base={item.base} q={sinCobrador} onAbrir={onAbrir} onCerrar={onCerrar} onVolver={onVolver} />;
  return <PagosDetalle item={item} q={query} onAbrir={onAbrir} onCerrar={onCerrar} onVolver={onVolver} />;
}

interface Comun { onAbrir: (i: DetalleItem) => void; onCerrar: () => void; onVolver?: () => void }

const Dato = ({ etiqueta, valor, nota, acento }: { etiqueta: string; valor: ReactNode; nota?: ReactNode; acento?: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</p>
    <p className="mt-1 text-lg font-semibold leading-tight text-slate-900" style={acento ? { color: acento } : undefined}>{valor}</p>
    {nota && <p className="mt-0.5 text-[11.5px] text-slate-500">{nota}</p>}
  </div>
);

function Cargando() {
  return <div className="space-y-3"><Esqueleto alto="h-20" /><Esqueleto alto="h-48" /><Esqueleto alto="h-48" /></div>;
}

// --- Cliente 360 ---------------------------------------------------------------------------------

type TabCliente = 'documentos' | 'pagos' | 'compromisos' | 'contacto';

function ClienteDetalle({ id, q, onAbrir, onCerrar, onVolver }: Comun & { id: number; q: { desde: string; hasta: string } }) {
  const { data, loading, error, reload } = useApi<Cliente360>(`/cxc/analitica/clientes/${id}`, q);
  const [tab, setTab] = useState<TabCliente>('documentos');
  void onAbrir;

  const r = data?.riesgo;
  const columnasDoc: Columna<DocumentoClienteDetalle>[] = [
    { id: 'ref', encabezado: 'Documento', valor: (d) => d.referencia },
    { id: 'fecha', encabezado: 'Emitido', valor: (d) => d.fecha, render: (d) => fechaCorta(d.fecha) },
    { id: 'venc', encabezado: 'Vence', valor: (d) => d.vencimiento, render: (d) => fechaCorta(d.vencimiento) },
    { id: 'mora', encabezado: 'Atraso', alinear: 'der', valor: (d) => d.diasMora, render: (d) => (d.diasMora > 0 ? <span className="font-medium text-red-700">{d.diasMora} d</span> : <span className="text-slate-400">—</span>) },
    { id: 'total', encabezado: 'Total', alinear: 'der', valor: (d) => d.total, render: (d) => Q(d.total) },
    { id: 'saldo', encabezado: 'Saldo', alinear: 'der', valor: (d) => d.saldo, render: (d) => <strong>{Q(d.saldo)}</strong> },
    { id: 'estado', encabezado: 'Estado', valor: (d) => d.estado, render: (d) => <EstadoPill estado={d.estado} /> },
  ];

  return (
    <Drawer titulo={data?.riesgo.nombre ?? 'Cliente'} onCerrar={onCerrar} onVolver={onVolver}
      subtitulo={r ? <span className="flex flex-wrap items-center gap-2">NIT {r.nit ?? '—'} <RiesgoPill nivel={r.nivel} score={r.score} /></span> : undefined}>
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <Cargando />}
      {data && r && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato etiqueta="Saldo pendiente" valor={Q(r.saldoTotal)} />
            <Dato etiqueta="Saldo vencido" valor={Q(r.saldoVencido)} acento={r.saldoVencido > 0 ? COLOR.critico : undefined} nota={`${r.documentosVencidos} documento(s)`} />
            <Dato etiqueta="Atraso máximo" valor={`${r.diasMaxMora} días`} />
            <Dato etiqueta="Pago promedio" valor={r.diasPromedioPago == null ? 'Sin pagos' : r.diasPromedioPago <= 0 ? 'A tiempo' : `${r.diasPromedioPago} d tarde`} nota="días respecto al vencimiento" />
          </div>

          <Panel titulo="¿Por qué este puntaje?" subtitulo={`Riesgo ${r.score} de 100. Cada factor suma puntos hacia el total.`}>
            <ul className="space-y-3">
              {r.factores.map((f) => (
                <li key={f.id}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="font-medium text-slate-800">{f.etiqueta}</span>
                    <span className="tabular-nums text-slate-600">{f.puntos} / {f.maximo}</span>
                  </div>
                  <Medidor valor={f.puntos} max={f.maximo} color={f.puntos / f.maximo >= 0.6 ? COLOR.critico : COLOR.azul} etiqueta={f.etiqueta} />
                  <p className="mt-0.5 text-[12px] text-slate-500">{f.detalle}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Pestanas<TabCliente> valor={tab} onCambiar={setTab} opciones={[
            { id: 'documentos', etiqueta: 'Documentos', conteo: data.documentos.length },
            { id: 'pagos', etiqueta: 'Pagos', conteo: data.pagos.length },
            { id: 'compromisos', etiqueta: 'Promesas y convenios', conteo: data.promesas.length + data.convenios.length },
            { id: 'contacto', etiqueta: 'Gestiones y visitas', conteo: data.gestiones.length + data.visitas.length },
          ]} />

          {tab === 'documentos' && <DataGrid filas={data.documentos} columnas={columnasDoc} clave={(d) => d.idDocumento} porPagina={8} compacta vacio="Sin documentos." />}
          {tab === 'pagos' && (
            <DataGrid filas={data.pagos} clave={(p) => p.idPago} porPagina={8} compacta vacio="Este cliente aún no registra pagos." columnas={[
              { id: 'f', encabezado: 'Fecha', valor: (p) => p.fecha, render: (p) => fechaCorta(p.fecha) },
              { id: 'm', encabezado: 'Monto', alinear: 'der', valor: (p) => p.monto, render: (p) => <strong>{Q(p.monto)}</strong> },
              { id: 'fp', encabezado: 'Forma de pago', valor: (p) => p.formaPago },
              { id: 'r', encabezado: 'Referencia', valor: (p) => p.referencia },
              { id: 'e', encabezado: 'Estado', valor: (p) => p.estado, render: (p) => <EstadoPill estado={p.estado} /> },
            ]} />
          )}
          {tab === 'compromisos' && (
            <div className="space-y-4">
              <DataGrid filas={data.promesas} clave={(p) => p.idPromesa} porPagina={6} compacta vacio="Sin promesas de pago." columnas={[
                { id: 'f', encabezado: 'Promesa', valor: (p) => p.fecha, render: (p) => fechaCorta(p.fecha) },
                { id: 'c', encabezado: 'Compromiso', valor: (p) => p.fechaCompromiso, render: (p) => <span className={p.vencida ? 'font-medium text-red-700' : ''}>{fechaCorta(p.fechaCompromiso)}{p.vencida ? ' · vencida' : ''}</span> },
                { id: 'm', encabezado: 'Monto', alinear: 'der', valor: (p) => p.monto, render: (p) => Q(p.monto) },
                { id: 'e', encabezado: 'Estado', valor: (p) => p.estado, render: (p) => <EstadoPill estado={p.estado} /> },
              ]} />
              <DataGrid filas={data.convenios} clave={(c) => c.idConvenio} porPagina={6} compacta vacio="Sin convenios de pago." columnas={[
                { id: 'f', encabezado: 'Convenio', valor: (c) => c.fecha, render: (c) => fechaCorta(c.fecha) },
                { id: 'd', encabezado: 'Deuda convenida', alinear: 'der', valor: (c) => c.deuda, render: (c) => Q(c.deuda) },
                { id: 'e', encabezado: 'Estado', valor: (c) => c.estado, render: (c) => <EstadoPill estado={c.estado} /> },
              ]} />
            </div>
          )}
          {tab === 'contacto' && (
            <div className="space-y-4">
              <DataGrid filas={data.gestiones} clave={(g) => g.idGestion} porPagina={6} compacta vacio="Sin gestiones de cobro." columnas={[
                { id: 'f', encabezado: 'Fecha', valor: (g) => g.fecha, render: (g) => fechaCorta(g.fecha) },
                { id: 't', encabezado: 'Tipo', valor: (g) => g.tipo, render: (g) => etiquetaEstado(g.tipo) },
                { id: 'r', encabezado: 'Resultado', valor: (g) => g.resultado, render: (g) => etiquetaEstado(g.resultado) },
                { id: 'o', encabezado: 'Observación', valor: (g) => g.observacion },
              ]} />
              <DataGrid filas={data.visitas} clave={(v) => `${v.idRuta}-${v.fecha}`} porPagina={6} compacta vacio="Sin visitas en ruta." columnas={[
                { id: 'f', encabezado: 'Fecha', valor: (v) => v.fecha, render: (v) => fechaCorta(v.fecha) },
                { id: 'r', encabezado: 'Ruta', valor: (v) => v.codigoRuta },
                { id: 'c', encabezado: 'Cobrador', valor: (v) => v.cobrador },
                { id: 'e', encabezado: 'Resultado de la visita', valor: (v) => v.estado, render: (v) => <EstadoPill estado={v.estado} /> },
              ]} />
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

// --- Cobrador ---------------------------------------------------------------------------------------

type TabCobrador = 'pagos' | 'clientes' | 'gestiones' | 'rutas';

function CobradorDetalleView({ id, q, onAbrir, onCerrar, onVolver }: Comun & { id: number; q: { desde: string; hasta: string; idRuta?: number } }) {
  const { data, loading, error, reload } = useApi<CobradorDetalle>(`/cxc/analitica/cobradores/${id}`, q);
  const [tab, setTab] = useState<TabCobrador>('pagos');
  const c = data?.cobrador;
  const v = c ? variacion(c.cobrado, c.cobradoAnterior) : null;
  const serie = data ? agruparSerie(data.serie.map((s) => ({ fecha: s.fecha, valor: s.cobrado })), ['valor']) : [];

  return (
    <Drawer titulo={c?.nombre ?? 'Cobrador'} onCerrar={onCerrar} onVolver={onVolver}
      subtitulo={c ? `${c.codigo ?? 'Sin código'} · Puesto ${c.posicion} en el ranking de cobro` : undefined}>
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <Cargando />}
      {data && c && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Dato etiqueta="Cobrado" valor={Q(c.cobrado)} nota={v && v.direccion !== 'nuevo' ? <Delta actual={c.cobrado} anterior={c.cobradoAnterior} etiqueta="" /> : 'Sin base de comparación'} />
            <Dato etiqueta="Pagos aplicados" valor={entero(c.pagos)} nota={`${entero(c.clientesCobrados)} cliente(s)`} />
            <Dato etiqueta="Ticket promedio" valor={Q(c.ticketPromedio)} />
            <Dato etiqueta="Participación" valor={pct(c.participacion)} nota="del total cobrado" />
            <Dato etiqueta="Gestiones" valor={entero(c.gestiones)} nota={`${pct(c.efectividadGestion, 0)} con respuesta`} />
            <Dato etiqueta="Promesas logradas" valor={entero(c.promesas)} nota={`${entero(c.promesasCumplidas)} cumplida(s)`} />
            <Dato etiqueta="Rutas" valor={entero(c.rutas)} nota={`${entero(c.paradasVisitadas)} de ${entero(c.paradas)} paradas`} />
            <Dato etiqueta="Efectividad de ruta" valor={pct(c.efectividadRuta, 0)} />
          </div>

          <Panel titulo="Cobro diario" subtitulo="Pagos aplicados por este cobrador en el período">
            <AreaSimple datos={serie.map((s) => ({ fecha: String(s.fecha), etiqueta: String(s.etiqueta), valor: Number(s.valor) }))} />
          </Panel>

          <Pestanas<TabCobrador> valor={tab} onCambiar={setTab} opciones={[
            { id: 'pagos', etiqueta: 'Pagos aplicados', conteo: data.pagos.length },
            { id: 'clientes', etiqueta: 'Clientes', conteo: data.clientes.length },
            { id: 'gestiones', etiqueta: 'Gestiones', conteo: data.gestiones.length },
            { id: 'rutas', etiqueta: 'Rutas', conteo: data.rutas.length },
          ]} />

          {tab === 'pagos' && <TablaPagos pagos={data.pagos} onAbrir={onAbrir} />}
          {tab === 'clientes' && (
            <DataGrid filas={data.clientes} clave={(x) => x.idCliente} porPagina={8} compacta vacio="Sin clientes cobrados en el período."
              onFila={(x) => onAbrir({ tipo: 'cliente', id: x.idCliente })} etiquetaFila={(x) => `Ver ficha de ${x.nombre}`}
              columnas={[
                { id: 'n', encabezado: 'Cliente', valor: (x) => x.nombre },
                { id: 'p', encabezado: 'Pagos', alinear: 'der', valor: (x) => x.pagos },
                { id: 'm', encabezado: 'Cobrado', alinear: 'der', valor: (x) => x.cobrado, render: (x) => <strong>{Q(x.cobrado)}</strong> },
              ]} />
          )}
          {tab === 'gestiones' && <TablaGestiones gestiones={data.gestiones} onAbrir={onAbrir} />}
          {tab === 'rutas' && (
            <DataGrid filas={data.rutas} clave={(x) => x.idRuta} porPagina={8} compacta vacio="Sin rutas en el período."
              columnas={[
                { id: 'c', encabezado: 'Código', valor: (x) => x.codigo },
                { id: 'n', encabezado: 'Ruta', valor: (x) => x.nombre },
                { id: 'f', encabezado: 'Fecha', valor: (x) => x.fecha, render: (x) => fechaCorta(x.fecha) },
                { id: 'p', encabezado: 'Visitadas', alinear: 'der', valor: (x) => x.visitadas, render: (x) => `${x.visitadas} / ${x.paradas}` },
                { id: 'e', encabezado: 'Estado', valor: (x) => x.estado, render: (x) => <EstadoPill estado={x.estado} /> },
              ]} />
          )}
        </>
      )}
    </Drawer>
  );
}

function TablaPagos({ pagos, onAbrir }: { pagos: PagoAplicadoDetalle[]; onAbrir: (i: DetalleItem) => void }) {
  return (
    <DataGrid filas={pagos} clave={(p) => p.idAplicacion} porPagina={8} compacta vacio="Sin pagos aplicados en el período."
      onFila={(p) => onAbrir({ tipo: 'cliente', id: p.idCliente })} etiquetaFila={(p) => `Ver ficha de ${p.cliente}`}
      buscar={(p) => `${p.cliente} ${p.documento} ${p.referencia ?? ''}`} placeholderBuscar="Buscar cliente o documento…"
      columnas={[
        { id: 'f', encabezado: 'Fecha', valor: (p) => p.fecha, render: (p) => fechaCorta(p.fecha) },
        { id: 'c', encabezado: 'Cliente', valor: (p) => p.cliente },
        { id: 'd', encabezado: 'Documento', valor: (p) => p.documento },
        { id: 'fp', encabezado: 'Forma de pago', valor: (p) => p.formaPago },
        { id: 'm', encabezado: 'Monto', alinear: 'der', valor: (p) => p.monto, render: (p) => <strong>{Q(p.monto)}</strong>, total: (f) => Q(f.reduce((s, x) => s + x.monto, 0)) },
      ]} />
  );
}

function TablaGestiones({ gestiones, onAbrir }: { gestiones: GestionDetalle[]; onAbrir: (i: DetalleItem) => void }) {
  return (
    <DataGrid filas={gestiones} clave={(g) => g.idGestion} porPagina={8} compacta vacio="Sin gestiones en el período."
      onFila={(g) => onAbrir({ tipo: 'cliente', id: g.idCliente })} etiquetaFila={(g) => `Ver ficha de ${g.cliente}`}
      columnas={[
        { id: 'f', encabezado: 'Fecha', valor: (g) => g.fecha, render: (g) => fechaCorta(g.fecha) },
        { id: 'c', encabezado: 'Cliente', valor: (g) => g.cliente },
        { id: 't', encabezado: 'Tipo', valor: (g) => g.tipo, render: (g) => etiquetaEstado(g.tipo) },
        { id: 'r', encabezado: 'Resultado', valor: (g) => g.resultado, render: (g) => etiquetaEstado(g.resultado) },
        { id: 'm', encabezado: 'Compromiso', alinear: 'der', valor: (g) => g.montoCompromiso, render: (g) => (g.montoCompromiso ? Q(g.montoCompromiso) : '—') },
      ]} />
  );
}

// --- Ruta (grupo) ----------------------------------------------------------------------------------------

function RutaDetalleView({ base, q, onAbrir, onCerrar, onVolver }: Comun & { base: string; q: { desde: string; hasta: string } }) {
  const { data, loading, error, reload } = useApi<RutaDetalleGrupo>('/cxc/analitica/rutas/detalle', { ...q, base });
  const [tab, setTab] = useState<'salidas' | 'paradas'>('salidas');
  return (
    <Drawer titulo={base} subtitulo="Todas las salidas de esta ruta en el período" onCerrar={onCerrar} onVolver={onVolver}>
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <Cargando />}
      {data && (
        <>
          <Pestanas<'salidas' | 'paradas'> valor={tab} onCambiar={setTab} opciones={[
            { id: 'salidas', etiqueta: 'Salidas', conteo: data.salidas.length },
            { id: 'paradas', etiqueta: 'Paradas', conteo: data.paradas.length },
          ]} />
          {tab === 'salidas' && (
            <DataGrid filas={data.salidas} clave={(s) => s.idRuta} porPagina={8} compacta vacio="Sin salidas."
              onFila={(s) => onAbrir({ tipo: 'cobrador', id: s.idEmpleado })} etiquetaFila={(s) => `Ver ficha de ${s.cobrador}`}
              columnas={[
                { id: 'c', encabezado: 'Código', valor: (s) => s.codigo },
                { id: 'f', encabezado: 'Fecha', valor: (s) => s.fecha, render: (s) => fechaCorta(s.fecha) },
                { id: 'cb', encabezado: 'Cobrador', valor: (s) => s.cobrador },
                { id: 'v', encabezado: 'Visitadas', alinear: 'der', valor: (s) => s.visitadas, render: (s) => `${s.visitadas} / ${s.paradas}` },
                { id: 'm', encabezado: 'Pendiente', alinear: 'der', valor: (s) => s.montoPendiente, render: (s) => Q(s.montoPendiente) },
                { id: 'e', encabezado: 'Estado', valor: (s) => s.estado, render: (s) => <EstadoPill estado={s.estado} /> },
              ]} />
          )}
          {tab === 'paradas' && (
            <DataGrid filas={data.paradas} clave={(p) => `${p.idRuta}-${p.idCliente}`} porPagina={10} compacta vacio="Sin paradas."
              onFila={(p) => onAbrir({ tipo: 'cliente', id: p.idCliente })} etiquetaFila={(p) => `Ver ficha de ${p.cliente}`}
              buscar={(p) => p.cliente} placeholderBuscar="Buscar cliente…"
              columnas={[
                { id: 'f', encabezado: 'Fecha', valor: (p) => p.fecha, render: (p) => fechaCorta(p.fecha) },
                { id: 'r', encabezado: 'Ruta', valor: (p) => p.codigoRuta },
                { id: 'c', encabezado: 'Cliente', valor: (p) => p.cliente },
                { id: 'm', encabezado: 'Pendiente', alinear: 'der', valor: (p) => p.montoPendiente, render: (p) => (p.montoPendiente == null ? '—' : Q(p.montoPendiente)) },
                { id: 'e', encabezado: 'Visita', valor: (p) => p.estadoVisita, render: (p) => <EstadoPill estado={p.estadoVisita} /> },
              ]} />
          )}
        </>
      )}
    </Drawer>
  );
}

// --- Pagos de un día / fecha -------------------------------------------------------------------------------------

function PagosDetalle({ item, q, onAbrir, onCerrar, onVolver }: Comun & { item: Extract<DetalleItem, { tipo: 'pagos' }>; q: QueryDetalle }) {
  const { data, loading, error, reload } = useApi<PagoAplicadoDetalle[]>('/cxc/analitica/dias-cobro/detalle', { ...q, tipo: item.modo, valor: item.valor });
  const total = data?.reduce((s, p) => s + p.monto, 0) ?? 0;
  return (
    <Drawer titulo={item.titulo} subtitulo={data ? `${data.length} pago(s) aplicados · ${Q(total)}` : 'Pagos aplicados'} onCerrar={onCerrar} onVolver={onVolver}>
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <Cargando />}
      {data && <TablaPagos pagos={data} onAbrir={onAbrir} />}
    </Drawer>
  );
}
