// Configuración de rutas para el ERP Universitario
import type { RouteObject } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';

// --- CXC / Dashboard ---
import { CxcAppLayout } from '../modules/cxc/shared/CxcAppLayout';
import { DashboardPage } from '../modules/cxc/dashboard/DashboardPage';

// --- CXC / Tutoriales ---
import { TutorialsPage } from '../modules/cxc/tutoriales';

// --- CXC / Reportes ---
import { ReportesLayout } from '../modules/cxc/reportes/ReportesLayout';
import { AntiguedadSaldosPage } from '../modules/cxc/reportes/AntiguedadSaldosPage';
import { EstadoCuentaPage } from '../modules/cxc/reportes/EstadoCuentaPage';
import { LibroVentasPage } from '../modules/cxc/reportes/LibroVentasPage';
import { EstadisticaVentasPage } from '../modules/cxc/reportes/EstadisticaVentasPage';
import { EstadisticaCobranzaPage } from '../modules/cxc/reportes/EstadisticaCobranzaPage';

// --- CXC / Facturación ---
import { FacturasPage } from '../modules/cxc/facturacion/FacturasPage';

// --- CXC / Organización ---
import { OrganizacionLayout } from '../modules/cxc/organizacion/organizacionLayout';
import { EmpresasPage } from '../modules/cxc/organizacion/EmpresasPage';
import { SucursalesPage } from '../modules/cxc/organizacion/SucursalesPage';
import { RutasPage } from '../modules/cxc/organizacion/RutasPage';
import { RutaDetallePage } from '../modules/cxc/organizacion/RutaDetallePage';

// --- CXC / Cobranza ---
import { CobranzaLayout } from '../modules/cxc/cobranza/cobranzaLayout';
import { GestionesCobroPage } from '../modules/cxc/cobranza/GestionesCobroPage';
import { PromesasPagoPage } from '../modules/cxc/cobranza/PromesasPagoPage';
import { ConveniosPagoPage } from '../modules/cxc/cobranza/ConveniosPagoPage';
import { ConvenioDetallePage } from '../modules/cxc/cobranza/ConvenioDetallePage';

// --- CXC / Crédito ---
import { CreditoLayout } from '../modules/cxc/credito/CreditoLayout';
import { CondicionesCreditoPage } from '../modules/cxc/credito/CondicionesCreditoPage';
import { NotasCreditoPage } from '../modules/cxc/credito/NotasCreditoPage';
import { AplicacionesNotaCreditoPage } from '../modules/cxc/credito/AplicacionesNotaCreditoPage';
import { MoraPage } from '../modules/cxc/credito/MoraPage';

// --- CXC / Pagos ---
import { PagosLayout } from '../modules/cxc/pagos/PagosLayout';
import { PagosPage } from '../modules/cxc/pagos/PagosPage';
import { AplicacionesPagoPage } from '../modules/cxc/pagos/AplicacionesPagoPage';
import { AnticiposPage } from '../modules/cxc/pagos/AnticiposPage';
import { AplicacionesAnticipoPage } from '../modules/cxc/pagos/AplicacionesAnticipoPage';
import { RecibosPage } from '../modules/cxc/pagos/RecibosPage';
import { FormasPagoPage } from '../modules/cxc/pagos/FormasPagoPage';
// --- CXC / Documentos ---
import { DocumentosLayout } from '../modules/cxc/documentos/documentosLayout';
import { DocumentosPage } from '../modules/cxc/documentos/DocumentosPage';
import { DocumentoDetallePage } from '../modules/cxc/documentos/DocumentoDetallePage';
import { TiposDocumentoPage } from '../modules/cxc/documentos/TiposDocumentoPage';
import { AjustesPage } from '../modules/cxc/documentos/AjustesPage';


export const routes: RouteObject[] = [
  // --- CXC / Dashboard ---
  {
    path: '/cxc/dashboard',
    element: (
      <MainLayout>
        <CxcAppLayout>
          <DashboardPage />
        </CxcAppLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Tutoriales ---
  {
    path: '/cxc/tutoriales',
    element: (
      <MainLayout>
        <CxcAppLayout>
          <TutorialsPage />
        </CxcAppLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Facturación ---
  {
    path: '/cxc/facturacion/facturas',
    element: (
      <MainLayout>
        <CxcAppLayout>
          <FacturasPage />
        </CxcAppLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Reportes ---
  {
    path: '/cxc/reportes/antiguedad-saldos',
    element: (
      <MainLayout>
        <ReportesLayout>
          <AntiguedadSaldosPage />
        </ReportesLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/reportes/libro-ventas',
    element: (
      <MainLayout>
        <ReportesLayout>
          <LibroVentasPage />
        </ReportesLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/reportes/estadistica-ventas',
    element: (
      <MainLayout>
        <ReportesLayout>
          <EstadisticaVentasPage />
        </ReportesLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/reportes/estadistica-cobranza',
    element: (
      <MainLayout>
        <ReportesLayout>
          <EstadisticaCobranzaPage />
        </ReportesLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/reportes/estado-cuenta',
    element: (
      <MainLayout>
        <ReportesLayout>
          <EstadoCuentaPage />
        </ReportesLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Organización ---
  {
    path: '/cxc/organizacion/empresas',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <EmpresasPage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/organizacion/sucursales',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <SucursalesPage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/organizacion/rutas',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <RutasPage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/organizacion/rutas/:id',
    element: (
      <MainLayout>
        <OrganizacionLayout>
          <RutaDetallePage />
        </OrganizacionLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Cobranza ---
  {
    path: '/cxc/cobranza/gestiones-cobro',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <GestionesCobroPage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/cobranza/promesas-pago',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <PromesasPagoPage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/cobranza/convenios-pago',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <ConveniosPagoPage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/cobranza/convenios-pago/:id',
    element: (
      <MainLayout>
        <CobranzaLayout>
          <ConvenioDetallePage />
        </CobranzaLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Pagos ---
  {
    path: '/cxc/pagos/pagos',
    element: (
      <MainLayout>
        <PagosLayout>
          <PagosPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/aplicaciones-pago',
    element: (
      <MainLayout>
        <PagosLayout>
          <AplicacionesPagoPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/anticipos',
    element: (
      <MainLayout>
        <PagosLayout>
          <AnticiposPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/aplicaciones-anticipo',
    element: (
      <MainLayout>
        <PagosLayout>
          <AplicacionesAnticipoPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/recibos',
    element: (
      <MainLayout>
        <PagosLayout>
          <RecibosPage />
        </PagosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/pagos/formas-pago',
    element: (
      <MainLayout>
        <PagosLayout>
          <FormasPagoPage />
        </PagosLayout>
      </MainLayout>
    ),
  },

  // --- CXC / Crédito ---
  {
    path: '/cxc/credito/condiciones-credito',
    element: (
      <CreditoLayout>
        <CondicionesCreditoPage />
      </CreditoLayout>
    ),
  },
  {
    path: '/cxc/credito/notas-credito',
    element: (
      <CreditoLayout>
        <NotasCreditoPage />
      </CreditoLayout>
    ),
  },
  {
    path: '/cxc/credito/aplicaciones-nota-credito',
    element: (
      <CreditoLayout>
        <AplicacionesNotaCreditoPage />
      </CreditoLayout>
    ),
  },
  {
    path: '/cxc/credito/mora',
    element: (
      <CreditoLayout>
        <MoraPage />
      </CreditoLayout>
    ),
  },

  // --- CXC / Documentos ---
  {
    path: '/cxc/documentos/documentos',
    element: (
      <MainLayout>
        <DocumentosLayout>
          <DocumentosPage />
        </DocumentosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/documentos/documentos/:id',
    element: (
      <MainLayout>
        <DocumentosLayout>
          <DocumentoDetallePage />
        </DocumentosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/documentos/tipos-documento',
    element: (
      <MainLayout>
        <DocumentosLayout>
          <TiposDocumentoPage />
        </DocumentosLayout>
      </MainLayout>
    ),
  },
  {
    path: '/cxc/documentos/ajustes',
    element: (
      <MainLayout>
        <DocumentosLayout>
          <AjustesPage />
        </DocumentosLayout>
      </MainLayout>
    ),
  },
];
