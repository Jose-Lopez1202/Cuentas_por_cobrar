import { useState, type ReactNode } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts';
import type { CeldaCalor, ClienteRiesgo } from '@erp/contracts';
import { COLOR, Qc, RIESGO, Q, entero } from '../format';

/**
 * Gráficos del módulo de análisis. Reglas de la guía de visualización: líneas de 2 px,
 * barras con extremo redondeado de 4 px y base recta, rejilla horizontal tenue, un solo eje,
 * leyenda siempre que haya dos series y tooltip en cada marca.
 */

const EJE = { fontSize: 11, fill: COLOR.gris };

export function TooltipCaja({ titulo, filas }: { titulo?: string; filas: Array<{ color?: string; etiqueta: string; valor: string }> }) {
  return (
    <div className="min-w-[150px] rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-lg">
      {titulo && <p className="mb-1 font-semibold text-slate-800">{titulo}</p>}
      {filas.map((f) => (
        <p key={f.etiqueta} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            {f.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} aria-hidden="true" />}
            {f.etiqueta}
          </span>
          <span className="font-semibold tabular-nums text-slate-900">{f.valor}</span>
        </p>
      ))}
    </div>
  );
}

interface SerieDef { clave: string; etiqueta: string; color: string; area?: boolean }

/** Evolución en el tiempo, con comparación opcional del período anterior en gris. */
export function TendenciaChart({ datos, series, alto = 300, formato = Q }: {
  datos: Array<Record<string, number | string>>;
  series: SerieDef[];
  alto?: number;
  formato?: (n: number) => string;
}) {
  return (
    <div style={{ height: alto }} role="img" aria-label={`Evolución de ${series.map((s) => s.etiqueta).join(' y ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={COLOR.rejilla} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={{ stroke: COLOR.eje }} minTickGap={28} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => Qc(v as number).replace('Q ', '')} />
          <Tooltip
            cursor={{ stroke: COLOR.eje }}
            content={({ active, payload, label }) => active && payload?.length ? (
              <TooltipCaja titulo={String(label)} filas={payload.map((p) => ({ color: p.color, etiqueta: String(p.name), valor: formato(Number(p.value)) }))} />
            ) : null}
          />
          {series.length > 1 && <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />}
          {series.map((s) => s.area
            ? <Area isAnimationActive={false} key={s.clave} dataKey={s.clave} name={s.etiqueta} type="monotone" stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.1} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
            : <Line isAnimationActive={false} key={s.clave} dataKey={s.clave} name={s.etiqueta} type="monotone" stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaSimple({ datos, color = COLOR.azul, alto = 160, etiqueta = 'Cobrado' }: {
  datos: Array<{ fecha: string; etiqueta?: string; valor: number }>; color?: string; alto?: number; etiqueta?: string;
}) {
  return (
    <div style={{ height: alto }} role="img" aria-label={`Evolución de ${etiqueta}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={COLOR.rejilla} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={{ stroke: COLOR.eje }} minTickGap={32} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => Qc(v as number).replace('Q ', '')} />
          <Tooltip cursor={{ stroke: COLOR.eje }} content={({ active, payload, label }) => active && payload?.length
            ? <TooltipCaja titulo={String(label)} filas={[{ color, etiqueta, valor: Q(Number(payload[0].value)) }]} /> : null} />
          <Area isAnimationActive={false} dataKey="valor" type="monotone" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface ColumnaDato { clave: string; etiqueta: string; valor: number; extra?: string; color?: string }

/** Columnas verticales; la destacada va en tono pleno y el resto en tono suave. */
export function ColumnasChart({ datos, color = COLOR.azul, destacada, alto = 220, formato = Q, onSeleccionar, etiquetaValor = 'Cobrado' }: {
  datos: ColumnaDato[]; color?: string; destacada?: string; alto?: number; formato?: (n: number) => string;
  onSeleccionar?: (d: ColumnaDato) => void; etiquetaValor?: string;
}) {
  return (
    <div style={{ height: alto }} role="img" aria-label={`Gráfico de columnas: ${etiquetaValor}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={COLOR.rejilla} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={{ stroke: COLOR.eje }} interval={0} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => Qc(v as number).replace('Q ', '')} />
          <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as ColumnaDato;
            return <TooltipCaja titulo={d.etiqueta} filas={[{ color: d.color ?? color, etiqueta: etiquetaValor, valor: formato(d.valor) }, ...(d.extra ? [{ etiqueta: 'Detalle', valor: d.extra }] : [])]} />;
          }} />
          <Bar isAnimationActive={false} dataKey="valor" maxBarSize={24} radius={[4, 4, 0, 0]} onClick={onSeleccionar ? (d) => onSeleccionar(d as unknown as ColumnaDato) : undefined} cursor={onSeleccionar ? 'pointer' : undefined}>
            {datos.map((d) => (
              <Cell key={d.clave} fill={d.color ?? color} fillOpacity={destacada && d.clave !== destacada ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface RankItem { clave: string | number; etiqueta: string; valor: number; secundario?: string; color?: string; marca?: ReactNode }

/** Ranking en barras horizontales con el valor en la punta; cada fila puede abrir su detalle. */
export function RankBars({ items, color = COLOR.azul, formato = Q, onSeleccionar, vacio = 'Sin datos en el período.' }: {
  items: RankItem[]; color?: string; formato?: (n: number) => string; onSeleccionar?: (i: RankItem) => void; vacio?: string;
}) {
  const max = Math.max(...items.map((i) => i.valor), 0);
  if (!items.length || max <= 0) return <p className="py-8 text-center text-sm text-slate-500">{vacio}</p>;
  return (
    <ul className="space-y-1">
      {items.map((i, idx) => {
        const fila = (
          <>
            <span className="w-5 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-400">{idx + 1}</span>
            <span className="w-[36%] min-w-0 shrink-0 truncate text-left text-[13px] text-slate-800" title={i.etiqueta}>{i.etiqueta}</span>
            <span className="relative h-2.5 flex-1 rounded-full bg-slate-100" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, (i.valor / max) * 100)}%`, backgroundColor: i.color ?? color }} />
            </span>
            <span className="w-24 shrink-0 text-right leading-tight">
              <span className="block text-[13px] font-semibold tabular-nums text-slate-900">{formato(i.valor)}</span>
              {i.secundario && <span className="block text-[11px] tabular-nums text-slate-500">{i.secundario}</span>}
            </span>
            {i.marca}
          </>
        );
        return (
          <li key={i.clave}>
            {onSeleccionar ? (
              <button type="button" onClick={() => onSeleccionar(i)} aria-label={`Ver detalle de ${i.etiqueta}`}
                className="flex w-full items-center gap-2.5 rounded px-1.5 py-1.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{fila}</button>
            ) : <div className="flex items-center gap-2.5 px-1.5 py-1.5">{fila}</div>}
          </li>
        );
      })}
    </ul>
  );
}

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Mapa de calor: día de la semana (columnas) por semana del mes (filas). Escala de un solo tono. */
export function MapaCalor({ celdas, onSeleccionar }: { celdas: CeldaCalor[]; onSeleccionar?: (diaSemana: number) => void }) {
  const [activa, setActiva] = useState<CeldaCalor | null>(null);
  const max = Math.max(...celdas.map((c) => c.cobrado), 0);
  const tono = (v: number) => (v <= 0 || max <= 0 ? '#f1f5f9' : `rgba(42,120,214,${0.14 + (v / max) * 0.86})`);
  const semanas = [1, 2, 3, 4, 5];
  return (
    <div>
      <div className="grid grid-cols-[56px_repeat(7,1fr)] gap-[2px] text-[11px]" role="group" aria-label="Mapa de calor del cobro por día de la semana y semana del mes">
        <div className="contents">
          <span />
          {DIAS_CORTOS.map((d) => <span key={d} className="pb-1 text-center font-medium text-slate-500">{d}</span>)}
        </div>
        {semanas.map((s) => (
          <div key={s} className="contents">
            <span className="flex items-center text-slate-500">{`Sem. ${s}`}</span>
            {DIAS_CORTOS.map((_, i) => {
              const c = celdas.find((x) => x.diaSemana === i + 1 && x.semanaMes === s) ?? { diaSemana: i + 1, semanaMes: s, cobrado: 0, pagos: 0 };
              const oscuro = max > 0 && c.cobrado / max > 0.55;
              return (
                <button
                  key={i} type="button" onClick={() => onSeleccionar?.(i + 1)}
                  onMouseEnter={() => setActiva(c)} onMouseLeave={() => setActiva(null)} onFocus={() => setActiva(c)} onBlur={() => setActiva(null)}
                  aria-label={`${DIAS_CORTOS[i]} de la semana ${s}: ${Q(c.cobrado)} en ${c.pagos} pagos`}
                  className={`flex h-9 items-center justify-center rounded-[3px] font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${oscuro ? 'text-white' : 'text-slate-700'}`}
                  style={{ backgroundColor: tono(c.cobrado) }}
                >
                  {c.cobrado > 0 ? Qc(c.cobrado).replace('Q ', '') : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11.5px] text-slate-500" aria-live="polite">
        <span>{activa ? `${DIAS_CORTOS[activa.diaSemana - 1]} · semana ${activa.semanaMes}: ${Q(activa.cobrado)} en ${entero(activa.pagos)} pago(s)` : 'Pasa el cursor sobre una celda para ver el detalle'}</span>
        <span className="flex items-center gap-1.5">Menos
          {[0.14, 0.4, 0.65, 1].map((o) => <span key={o} className="h-2.5 w-4 rounded-[2px]" style={{ backgroundColor: `rgba(42,120,214,${o})` }} aria-hidden="true" />)}
          Más
        </span>
      </div>
    </div>
  );
}

/** Matriz de riesgo: antigüedad (x) contra monto vencido (y); el color es el nivel de riesgo. */
export function MatrizRiesgo({ clientes, onSeleccionar, alto = 300 }: { clientes: ClienteRiesgo[]; onSeleccionar: (c: ClienteRiesgo) => void; alto?: number }) {
  const niveles = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO'] as const;
  return (
    <div style={{ height: alto }} role="img" aria-label="Matriz de riesgo: días de atraso contra saldo vencido por cliente">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 12, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={COLOR.rejilla} />
          <XAxis type="number" dataKey="diasMaxMora" name="Días de atraso" tick={EJE} tickLine={false} axisLine={{ stroke: COLOR.eje }}
            label={{ value: 'Días de atraso del documento más antiguo', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: COLOR.gris } }} />
          <YAxis type="number" dataKey="saldoVencido" name="Saldo vencido" tick={EJE} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => Qc(v as number).replace('Q ', '')} />
          <ZAxis type="number" dataKey="score" range={[120, 120]} />
          <Tooltip cursor={{ strokeDasharray: '3 3', stroke: COLOR.eje }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const c = payload[0].payload as ClienteRiesgo;
            return <TooltipCaja titulo={c.nombre} filas={[
              { color: RIESGO[c.nivel].color, etiqueta: 'Riesgo', valor: `${RIESGO[c.nivel].etiqueta} · ${c.score}` },
              { etiqueta: 'Saldo vencido', valor: Q(c.saldoVencido) },
              { etiqueta: 'Atraso máximo', valor: `${c.diasMaxMora} días` },
            ]} />;
          }} />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 6 }} />
          {niveles.map((n) => (
            <Scatter isAnimationActive={false}
              key={n} name={RIESGO[n].etiqueta} data={clientes.filter((c) => c.nivel === n)} fill={RIESGO[n].color}
              stroke="#fff" strokeWidth={2} cursor="pointer" onClick={(d) => onSeleccionar(d as unknown as ClienteRiesgo)}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
