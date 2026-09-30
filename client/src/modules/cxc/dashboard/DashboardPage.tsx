import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Coins,
  CreditCard,
  FileSpreadsheet,
  FolderOpen,
  ReceiptText,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import type { DashboardResumen } from '@erp/contracts';
import { apiClient, ApiError } from '../../../shared/api';
import {
  DonutChart,
  HorizontalBarList,
  KpiTile,
  StackedBar,
  TrendLineChart,
  VerticalBarChart,
  tint,
  type ChartDatum,
  type HorizontalBarItem,
} from '../../../shared/charts';
import { getStatusLabel, getStatusTone, TONE_HEX } from '../../../shared/components/UnifiedStatusBadge';

const formatMoney = (value: number) =>
  `Q ${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatCount = (value: number) => value.toLocaleString('es-GT');

// Un color de acento fijo por módulo (paleta categórica del skill de dataviz,
// en orden fijo). Nunca se reasigna ni se cicla: cada módulo es siempre el
// mismo color en todo el dashboard.
const MODULES = {
  documentos: { color: '#2a78d6', icon: FileSpreadsheet, label: 'Documentos' },
  cobranza: { color: '#eb6834', icon: ReceiptText, label: 'Cobranza' },
  credito: { color: '#1baf7a', icon: CreditCard, label: 'Crédito' },
  pagos: { color: '#4a3aa7', icon: WalletCards, label: 'Pagos' },
  organizacion: { color: '#008300', icon: UsersRound, label: 'Organización' },
} as const;

// Identidad pura (no es un estado bueno/malo): paleta categórica fija, un
// color por tipo, en el mismo orden siempre.
const TIPO_GESTION_COLORS: Record<string, string> = {
  LLAMADA: '#2a78d6',
  VISITA: '#eb6834',
  EMAIL: '#1baf7a',
  WHATSAPP: '#eda100',
  CARTA: '#e87ba4',
  OTRO: '#4a3aa7',
  SIN_TIPO: '#94a3b8',
};

function toStatusBars(
  items: Array<{ estado: string; cantidad: number; monto: number }>,
  monetary = true,
): HorizontalBarItem[] {
  return items.map((item) => ({
    key: item.estado,
    label: getStatusLabel(item.estado),
    value: item.cantidad,
    secondaryValue: monetary ? item.monto : undefined,
    color: TONE_HEX[getStatusTone(item.estado)],
  }));
}

function toTipoBars(items: Array<{ tipo: string; cantidad: number }>): HorizontalBarItem[] {
  return items.map((item) => ({
    key: item.tipo,
    label: getStatusLabel(item.tipo),
    value: item.cantidad,
    color: TIPO_GESTION_COLORS[item.tipo] ?? '#94a3b8',
  }));
}

// Rutas sí tienen estados con una connotación clara (planificada/en
// proceso/completada/cancelada): usa la misma paleta de status que el resto
// del dashboard en vez de la paleta categórica de identidad pura.
function toRutaEstadoBars(items: Array<{ tipo: string; cantidad: number }>): HorizontalBarItem[] {
  return items.map((item) => ({
    key: item.tipo,
    label: getStatusLabel(item.tipo),
    value: item.cantidad,
    color: TONE_HEX[getStatusTone(item.tipo)],
  }));
}

/** Misma paleta de estado que las barras, para circulares y columnas. */
function toStatusDatums(
  items: Array<{ estado: string; cantidad: number; monto: number }>,
  field: 'cantidad' | 'monto' = 'cantidad',
): ChartDatum[] {
  return items.map((item) => ({
    key: item.estado,
    label: getStatusLabel(item.estado),
    value: item[field],
    color: TONE_HEX[getStatusTone(item.estado)],
  }));
}

const CARTERA_COLORS = { vigente: '#2a78d6', vencida: '#d03b3b' } as const;

interface ModuleSectionProps {
  module: keyof typeof MODULES;
  description?: string;
  children: ReactNode;
}

/** Encabezado de módulo: icono + color de acento fijo, agrupa una o varias tarjetas. */
const ModuleSection = ({ module, description, children }: ModuleSectionProps) => {
  const { color, icon: Icon, label } = MODULES[module];
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: tint(color, 0.14), color }}
        >
          <Icon size={15} strokeWidth={2.5} />
        </div>
        <h2 className="text-sm font-bold text-slate-800 tracking-tight">{label}</h2>
        {description && <span className="text-xs text-slate-400">— {description}</span>}
      </div>
      {children}
    </section>
  );
};

interface ChartCardProps {
  title: string;
  children: ReactNode;
}

const ChartCard = ({ title, children }: ChartCardProps) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">{title}</h3>
    {children}
  </div>
);

export const DashboardPage = () => {
  const [resumen, setResumen] = useState<DashboardResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    apiClient
      .get<DashboardResumen>('/cxc/dashboard/resumen', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setResumen(data);
        setError(null);
      })
      .catch((err) => {
        // Una petición cancelada (cleanup de React StrictMode o cambio de
        // pantalla) ya no es la vigente: su fallo no debe mostrarse.
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el dashboard.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard de Cuentas por Cobrar</h1>
        <p className="text-sm text-slate-500">
          Resumen en vivo de cobranza, crédito, documentos, pagos y organización.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {isLoading && !resumen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[104px] bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
      )}

      {resumen && (
        <>
          {/* KPIs generales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="Cartera total"
              value={formatMoney(resumen.kpis.carteraTotal)}
              icon={Coins}
              color="#2a78d6"
              caption="Saldo pendiente, sin anulados"
            />
            <KpiTile
              label="Cartera vencida"
              value={formatMoney(resumen.kpis.carteraVencida)}
              icon={AlertTriangle}
              color="#d03b3b"
              caption="Documentos con fecha de vencimiento pasada"
            />
            <KpiTile
              label="% cartera vencida"
              value={`${resumen.kpis.porcentajeVencida.toFixed(1)}%`}
              icon={AlertTriangle}
              color="#fab219"
              caption="Sobre el total de la cartera"
            />
            <KpiTile
              label="Documentos abiertos"
              value={formatCount(resumen.kpis.documentosAbiertos)}
              icon={FolderOpen}
              color="#1baf7a"
              caption="Pendientes, parciales o vencidos"
            />
          </div>

          {/* Salud de la cartera */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Cartera: vigente vs. vencida">
              <DonutChart
                items={[
                  {
                    key: 'vigente',
                    label: 'Vigente',
                    value: Math.max(resumen.kpis.carteraTotal - resumen.kpis.carteraVencida, 0),
                    color: CARTERA_COLORS.vigente,
                  },
                  { key: 'vencida', label: 'Vencida', value: resumen.kpis.carteraVencida, color: CARTERA_COLORS.vencida },
                ]}
                valueFormatter={formatMoney}
                centerCaption="Cartera total"
              />
            </ChartCard>
            <ChartCard title="Saldo de documentos por estado">
              <VerticalBarChart items={toStatusDatums(resumen.documentos.porEstado, 'monto')} valueFormatter={formatMoney} />
            </ChartCard>
          </div>

          {/* Documentos */}
          <ModuleSection module="documentos">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Documentos por estado — cantidad y saldo asociado">
                <HorizontalBarList
                  items={toStatusBars(resumen.documentos.porEstado)}
                  valueFormatter={formatCount}
                  secondaryFormatter={(v) => `Saldo: ${formatMoney(v)}`}
                />
              </ChartCard>
              <ChartCard title="Distribución de documentos">
                <DonutChart items={toStatusDatums(resumen.documentos.porEstado)} valueFormatter={formatCount} centerCaption="Documentos" />
              </ChartCard>
            </div>
          </ModuleSection>

          {/* Cobranza */}
          <ModuleSection module="cobranza">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Gestiones de cobro por tipo">
                <DonutChart
                  variant="pie"
                  size={150}
                  items={toTipoBars(resumen.cobranza.gestionesPorTipo)}
                  valueFormatter={formatCount}
                />
              </ChartCard>
              <ChartCard title="Promesas de pago por estado">
                <VerticalBarChart items={toStatusDatums(resumen.cobranza.promesasPorEstado)} valueFormatter={formatCount} />
              </ChartCard>
              <ChartCard title="Convenios de pago por estado">
                <HorizontalBarList
                  items={toStatusBars(resumen.cobranza.conveniosPorEstado)}
                  valueFormatter={formatCount}
                  secondaryFormatter={(v) => `Deuda: ${formatMoney(v)}`}
                />
              </ChartCard>
              <ChartCard title="Monto comprometido en promesas">
                <DonutChart
                  items={toStatusDatums(resumen.cobranza.promesasPorEstado, 'monto')}
                  valueFormatter={formatMoney}
                  centerCaption="Comprometido"
                />
              </ChartCard>
              <div className="lg:col-span-2">
                <ChartCard title="Deuda en convenios por estado">
                  <StackedBar items={toStatusDatums(resumen.cobranza.conveniosPorEstado, 'monto')} valueFormatter={formatMoney} />
                </ChartCard>
              </div>
            </div>
          </ModuleSection>

          {/* Crédito */}
          <ModuleSection module="credito">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <KpiTile
                label="Documentos en mora activa"
                value={formatCount(resumen.credito.moraActiva.cantidadDocumentos)}
                icon={ReceiptText}
                color="#1baf7a"
              />
              <KpiTile
                label="Saldo vencido en mora"
                value={formatMoney(resumen.credito.moraActiva.montoTotal)}
                icon={ReceiptText}
                color="#d03b3b"
              />
              <ChartCard title="Notas de crédito por estado">
                <HorizontalBarList
                  items={toStatusBars(resumen.credito.notasCreditoPorEstado)}
                  valueFormatter={formatCount}
                  secondaryFormatter={(v) => `Monto: ${formatMoney(v)}`}
                />
              </ChartCard>
              <div className="lg:col-span-3">
                <ChartCard title="Monto de notas de crédito por estado">
                  <StackedBar
                    items={toStatusDatums(resumen.credito.notasCreditoPorEstado, 'monto')}
                    valueFormatter={formatMoney}
                  />
                </ChartCard>
              </div>
            </div>
          </ModuleSection>

          {/* Pagos */}
          <ModuleSection module="pagos">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Pagos por estado (cantidad)">
                <DonutChart items={toStatusDatums(resumen.pagos.porEstado)} valueFormatter={formatCount} centerCaption="Pagos" />
              </ChartCard>
              <ChartCard title="Pagos aplicados por mes">
                <VerticalBarChart
                  items={resumen.pagos.aplicadoPorMes.map((p) => ({
                    key: p.mes,
                    label: p.mes.slice(5),
                    value: p.monto,
                    color: MODULES.pagos.color,
                  }))}
                  valueFormatter={formatMoney}
                />
              </ChartCard>
              <ChartCard title="Pagos por estado">
                <HorizontalBarList
                  items={toStatusBars(resumen.pagos.porEstado)}
                  valueFormatter={formatCount}
                  secondaryFormatter={(v) => `Monto: ${formatMoney(v)}`}
                />
              </ChartCard>
              <ChartCard title="Pagos aplicados">
                <TrendLineChart
                  data={resumen.pagos.aplicadoPorMes.map((p) => ({ label: p.mes.slice(5), value: p.monto }))}
                  valueFormatter={formatMoney}
                  color={MODULES.pagos.color}
                  headline={{
                    title: formatMoney(resumen.pagos.aplicadoPorMes[resumen.pagos.aplicadoPorMes.length - 1]?.monto ?? 0),
                    caption: 'Aplicado este mes',
                  }}
                />
              </ChartCard>
            </div>
          </ModuleSection>

          {/* Organización */}
          <ModuleSection module="organizacion">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Rutas por estado">
                <HorizontalBarList
                  items={toRutaEstadoBars(resumen.organizacion.rutasPorEstado)}
                  valueFormatter={formatCount}
                />
              </ChartCard>
              <ChartCard title="Distribución de rutas">
                <DonutChart items={toRutaEstadoBars(resumen.organizacion.rutasPorEstado)} valueFormatter={formatCount} centerCaption="Rutas" />
              </ChartCard>
            </div>
          </ModuleSection>
        </>
      )}
    </div>
  );
};
