import { useState } from 'react';
import type { DiasCobroReporte } from '@erp/contracts';
import { ExportMenu } from '../../../shared/components/ExportMenu';
import type { ReportSpec } from '../../../shared/export/reportExport';
import { useApi } from './useApi';
import { useFiltros } from './useFiltros';
import { COLOR, Q, entero, fechaCorta, pct } from './format';
import { FilterBar } from './ui/FilterBar';
import { Encabezado, ErrorCaja, Esqueleto, Panel } from './ui/Panel';
import { KpiCard } from './ui/KpiCard';
import { ColumnasChart, MapaCalor, RankBars } from './ui/charts';
import { useDetalle } from './detalle/DetalleHost';

type Medida = 'promedio' | 'total';

export const DiasCobroPage = () => {
  const { filtros, query, cambiar, limpiar, hayFiltrosExtra } = useFiltros('90d');
  const { data, loading, error, reload } = useApi<DiasCobroReporte>('/cxc/analitica/dias-cobro', query);
  const { abrir, host } = useDetalle(query);
  const [medida, setMedida] = useState<Medida>('promedio');

  const valorDe = (d: { promedio: number; cobrado: number }) => (medida === 'promedio' ? d.promedio : d.cobrado);
  const mejor = data?.mejorDiaSemana, peor = data?.peorDiaSemana;
  const veces = mejor && peor && peor.promedio > 0 ? mejor.promedio / peor.promedio : null;

  const getSpec = (): ReportSpec | null => !data ? null : {
    filename: `dias-de-cobro-${data.desde}_${data.hasta}`,
    title: 'Mejores días de cobro', subtitle: `Periodo ${data.desde} a ${data.hasta}`,
    summary: [['Total cobrado', Q(data.totalCobrado)], ['Mejor dia de la semana', mejor ? `${mejor.etiqueta} (${Q(mejor.promedio)} promedio)` : 'N/D'], ['Mejor dia del mes', data.mejorDiaMes ? `Dia ${data.mejorDiaMes.valor}` : 'N/D']],
    sections: [
      { title: 'Por día de la semana', columns: [{ header: 'Dia' }, { header: 'Cobrado', type: 'money' }, { header: 'Pagos', type: 'int' }, { header: 'Promedio por dia', type: 'money' }, { header: 'Participacion %', type: 'percent' }], rows: data.porDiaSemana.map((d) => [d.etiqueta, d.cobrado, d.pagos, d.promedio, d.participacion]) },
      { title: 'Por día del mes', columns: [{ header: 'Dia del mes' }, { header: 'Cobrado', type: 'money' }, { header: 'Pagos', type: 'int' }, { header: 'Promedio', type: 'money' }, { header: 'Participacion %', type: 'percent' }], rows: data.porDiaMes.filter((d) => d.cobrado > 0).map((d) => [d.etiqueta, d.cobrado, d.pagos, d.promedio, d.participacion]) },
      { title: 'Fechas con más cobro', columns: [{ header: 'Fecha' }, { header: 'Cobrado', type: 'money' }, { header: 'Pagos', type: 'int' }], rows: data.mejoresFechas.map((f) => [f.fecha, f.cobrado, f.pagos]) },
    ],
  };

  return (
    <div>
      <FilterBar filtros={filtros} onChange={cambiar} onLimpiar={limpiar} mostrarLimpiar={hayFiltrosExtra}
        nota="Se cuenta el día en que el pago se aplicó a la factura" />
      <Encabezado
        titulo="Mejores días de cobro"
        descripcion="En qué días de la semana y del mes entra más dinero, para programar rutas, llamadas y recordatorios cuando más rinden."
        acciones={<ExportMenu getSpec={getSpec} disabledReason={!data || data.totalCobrado <= 0 ? 'No hay cobros en el período para exportar' : undefined} />}
      />
      {error && <ErrorCaja mensaje={error} onReintentar={reload} />}
      {loading && !data && <div className="space-y-4"><Esqueleto alto="h-[110px]" /><Esqueleto alto="h-80" /></div>}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard etiqueta="Total cobrado" valor={Q(data.totalCobrado)} color={COLOR.azul} nota={`${entero(data.porDiaSemana.reduce((s, d) => s + d.pagos, 0))} pagos aplicados`} />
            <KpiCard etiqueta="Mejor día de la semana" valor={mejor?.etiqueta ?? '—'} color={COLOR.aqua}
              nota={mejor ? `${Q(mejor.promedio)} en promedio por ${mejor.etiqueta.toLowerCase()}` : 'Sin cobros'} onClick={mejor ? () => abrir({ tipo: 'pagos', titulo: `Cobros de los ${mejor.etiqueta.toLowerCase()}`, modo: 'semana', valor: mejor.valor }) : undefined} />
            <KpiCard etiqueta="Día más flojo" valor={peor?.etiqueta ?? '—'} color={COLOR.naranja}
              nota={peor ? `${Q(peor.promedio)} en promedio${veces ? ` · ${veces.toLocaleString('es-GT', { maximumFractionDigits: 1 })}× menos que el mejor` : ''}` : 'El período debe incluir todos los días de la semana'} />
            <KpiCard etiqueta="Mejor día del mes" valor={data.mejorDiaMes ? `Día ${data.mejorDiaMes.valor}` : '—'} color={COLOR.violeta}
              nota={data.mejorDiaMes ? `${Q(data.mejorDiaMes.cobrado)} cobrados en ese día` : 'Sin cobros'} />
          </div>

          {data.totalCobrado > 0 && mejor && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-950" role="note">
              <strong>Lectura rápida:</strong> {mejor.etiqueta === peor?.etiqueta ? '' : `los ${mejor.etiqueta.toLowerCase()} concentran ${pct(mejor.participacion)} del cobro`}
              {peor && veces && veces > 1.2 ? ` y rinden ${veces.toLocaleString('es-GT', { maximumFractionDigits: 1 })} veces más que los ${peor.etiqueta.toLowerCase()}` : ''}.
              {' '}Programa las visitas y llamadas más importantes en esos días.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel titulo="Cobro por día de la semana" cargando={loading}
              subtitulo={medida === 'promedio' ? 'Promedio cobrado cada vez que ocurre ese día' : 'Total cobrado en ese día de la semana'}
              acciones={
                <div role="group" aria-label="Medida" className="inline-flex overflow-hidden rounded border border-slate-300">
                  {(['promedio', 'total'] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={medida === m} onClick={() => setMedida(m)}
                      className={`h-7 px-2.5 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${medida === m ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
                      {m === 'promedio' ? 'Promedio' : 'Total'}
                    </button>
                  ))}
                </div>}>
              <ColumnasChart
                etiquetaValor={medida === 'promedio' ? 'Promedio por día' : 'Total cobrado'}
                destacada={mejor ? String(mejor.valor) : undefined}
                datos={data.porDiaSemana.map((d) => ({ clave: String(d.valor), etiqueta: d.etiqueta.slice(0, 3), valor: valorDe(d), extra: `${entero(d.pagos)} pagos · ${pct(d.participacion)} del total` }))}
                onSeleccionar={(d) => { const dia = data.porDiaSemana.find((x) => String(x.valor) === d.clave); if (dia) abrir({ tipo: 'pagos', titulo: `Cobros de los ${dia.etiqueta.toLowerCase()}`, modo: 'semana', valor: dia.valor }); }} />
              <p className="mt-2 text-[11.5px] text-slate-500">Haz clic en una columna para ver los pagos de ese día.</p>
            </Panel>

            <Panel titulo="Mapa de calor" subtitulo="Cuánto se cobró según el día de la semana y la semana del mes" cargando={loading}>
              <MapaCalor celdas={data.calor} onSeleccionar={(dia) => { const d = data.porDiaSemana.find((x) => x.valor === dia); if (d) abrir({ tipo: 'pagos', titulo: `Cobros de los ${d.etiqueta.toLowerCase()}`, modo: 'semana', valor: dia }); }} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" titulo="Cobro por día del mes" subtitulo="Revela ciclos de pago: quincenas, fin de mes, fechas de planilla" cargando={loading}>
              <ColumnasChart
                alto={230} etiquetaValor={medida === 'promedio' ? 'Promedio' : 'Total cobrado'}
                destacada={data.mejorDiaMes ? String(data.mejorDiaMes.valor) : undefined}
                datos={data.porDiaMes.map((d) => ({ clave: String(d.valor), etiqueta: String(d.valor), valor: valorDe(d), extra: `${entero(d.pagos)} pagos` }))}
                onSeleccionar={(d) => abrir({ tipo: 'pagos', titulo: `Cobros del día ${d.clave} de cada mes`, modo: 'mes', valor: Number(d.clave) })} />
            </Panel>

            <Panel titulo="Fechas con más cobro" subtitulo="Los 5 días individuales más fuertes">
              <RankBars
                items={data.mejoresFechas.map((f) => ({ clave: f.fecha, etiqueta: fechaCorta(f.fecha), valor: f.cobrado, secundario: `${f.pagos} pagos` }))}
                onSeleccionar={(i) => abrir({ tipo: 'pagos', titulo: `Cobros del ${fechaCorta(String(i.clave))}`, modo: 'fecha', valor: String(i.clave) })}
                vacio="No hay cobros en el período." />
            </Panel>
          </div>

        </div>
      )}
      {host}
    </div>
  );
};
