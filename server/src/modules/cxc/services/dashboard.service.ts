import type { DashboardResumen } from '@erp/contracts';
import * as dashboardRepository from '../repositories/dashboard.repository';
import { roundMoney } from '../shared/financialRules';

export async function getResumen(): Promise<DashboardResumen> {
  const raw = await dashboardRepository.obtenerDatosResumen();

  const porcentajeVencida = raw.kpis.carteraTotal > 0
    ? roundMoney((raw.kpis.carteraVencida / raw.kpis.carteraTotal) * 100)
    : 0;

  return {
    kpis: {
      carteraTotal: roundMoney(raw.kpis.carteraTotal),
      carteraVencida: roundMoney(raw.kpis.carteraVencida),
      porcentajeVencida,
      documentosAbiertos: raw.kpis.documentosAbiertos,
    },
    documentos: { porEstado: raw.documentosPorEstado },
    cobranza: {
      gestionesPorTipo: raw.gestionesPorTipo,
      promesasPorEstado: raw.promesasPorEstado,
      conveniosPorEstado: raw.conveniosPorEstado,
    },
    credito: { moraActiva: raw.moraActiva, notasCreditoPorEstado: raw.notasCreditoPorEstado },
    pagos: { porEstado: raw.pagosPorEstado, aplicadoPorMes: raw.pagosAplicadosPorMes },
    organizacion: { rutasPorEstado: raw.rutasPorEstado },
  };
}
