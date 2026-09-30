import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  BarChart3,
  Coins,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  ShoppingCart,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';

type CxcMenuItem = {
  id: string;
  label: string;
  path: string;
};

type CxcMenuGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  matchPrefix: string;
  items: CxcMenuItem[];
};

/**
 * Navegación única del módulo CxC.
 *
 * Regla UX: el sidebar es la fuente de navegación de catálogos. No se
 * duplican las mismas opciones en un segundo navbar superior. Los recursos
 * dependientes (detalle/historial de documento, cuotas de convenio, detalle
 * de ruta) se administran desde su entidad padre y no se muestran como un
 * catálogo independiente.
 */
const CXC_GROUPS: CxcMenuGroup[] = [
  {
    id: 'reportes',
    label: 'Reportes',
    icon: BarChart3,
    matchPrefix: '/cxc/reportes',
    items: [
      { id: 'antiguedad-saldos', label: 'Antigüedad de Saldos', path: '/cxc/reportes/antiguedad-saldos' },
      { id: 'estado-cuenta', label: 'Estado de Cuenta', path: '/cxc/reportes/estado-cuenta' },
    ],
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icon: FileSpreadsheet,
    matchPrefix: '/cxc/documentos',
    items: [
      { id: 'documentos', label: 'Documentos', path: '/cxc/documentos/documentos' },
      { id: 'tipos-documento', label: 'Tipos de Documento', path: '/cxc/documentos/tipos-documento' },
      { id: 'ajustes', label: 'Ajustes', path: '/cxc/documentos/ajustes' },
    ],
  },
  {
    id: 'pagos',
    label: 'Pagos',
    icon: WalletCards,
    matchPrefix: '/cxc/pagos',
    items: [
      { id: 'pagos', label: 'Pagos', path: '/cxc/pagos/pagos' },
      { id: 'aplicaciones-pago', label: 'Aplicaciones de Pago', path: '/cxc/pagos/aplicaciones-pago' },
      { id: 'anticipos', label: 'Anticipos', path: '/cxc/pagos/anticipos' },
      { id: 'aplicaciones-anticipo', label: 'Aplicaciones de Anticipo', path: '/cxc/pagos/aplicaciones-anticipo' },
      { id: 'recibos', label: 'Recibos', path: '/cxc/pagos/recibos' },
      { id: 'formas-pago', label: 'Formas de Pago', path: '/cxc/pagos/formas-pago' },
    ],
  },
  {
    id: 'credito',
    label: 'Crédito',
    icon: CreditCard,
    matchPrefix: '/cxc/credito',
    items: [
      { id: 'condiciones-credito', label: 'Condiciones de Crédito', path: '/cxc/credito/condiciones-credito' },
      { id: 'notas-credito', label: 'Notas de Crédito', path: '/cxc/credito/notas-credito' },
      { id: 'aplicaciones-nota-credito', label: 'Aplicación Nota Crédito', path: '/cxc/credito/aplicaciones-nota-credito' },
      { id: 'mora', label: 'Mora', path: '/cxc/credito/mora' },
    ],
  },
  {
    id: 'cobranza',
    label: 'Cobranza',
    icon: ReceiptText,
    matchPrefix: '/cxc/cobranza',
    items: [
      { id: 'gestiones-cobro', label: 'Gestiones de Cobro', path: '/cxc/cobranza/gestiones-cobro' },
      { id: 'promesas-pago', label: 'Promesas de Pago', path: '/cxc/cobranza/promesas-pago' },
      { id: 'convenios-pago', label: 'Convenios de Pago', path: '/cxc/cobranza/convenios-pago' },
    ],
  },
  {
    id: 'organizacion',
    label: 'Organización',
    icon: UsersRound,
    matchPrefix: '/cxc/organizacion',
    items: [
      { id: 'empresas', label: 'Empresas', path: '/cxc/organizacion/empresas' },
      { id: 'sucursales', label: 'Sucursales', path: '/cxc/organizacion/sucursales' },
      { id: 'rutas', label: 'Rutas', path: '/cxc/organizacion/rutas' },
    ],
  },
];

const CXC_DASHBOARD_PATH = '/cxc/dashboard';

const MAIN_MODULES = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'compras', label: 'Compras', icon: ShoppingCart },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'cuentas_pagar', label: 'Cuentas por Pagar', icon: FileSpreadsheet },
  { id: 'cuentas_cobrar', label: 'Cuentas por Cobrar', icon: Coins },
  { id: 'bancos', label: 'Bancos', icon: Landmark },
] as const;

interface CxcAppLayoutProps {
  children: ReactNode;
}

export const CxcAppLayout = ({ children }: CxcAppLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isDashboardActive = location.pathname === CXC_DASHBOARD_PATH;

  const activeGroup = useMemo(
    () =>
      isDashboardActive
        ? undefined
        : CXC_GROUPS.find((group) => location.pathname.startsWith(group.matchPrefix)) ?? CXC_GROUPS[0],
    [location.pathname, isDashboardActive],
  );

  const [cxcOpen, setCxcOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroup ? { [activeGroup.id]: true } : {},
  );

  useEffect(() => {
    setCxcOpen(true);
    if (activeGroup) {
      setOpenGroups((current) => ({ ...current, [activeGroup.id]: true }));
    }
  }, [activeGroup]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

  const isSubItemActive = (item: CxcMenuItem) => {
    if (item.id === 'documentos') {
      return /^\/cxc\/documentos\/documentos(?:\/[^/]+)?$/.test(location.pathname);
    }
    if (item.id === 'convenios-pago') {
      return /^\/cxc\/cobranza\/convenios-pago(?:\/[^/]+)?$/.test(location.pathname);
    }
    if (item.id === 'rutas') {
      return /^\/cxc\/organizacion\/rutas(?:\/[^/]+)?$/.test(location.pathname);
    }
    return location.pathname === item.path;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <aside
        className="w-72 bg-slate-900 text-slate-300 flex flex-col h-screen shrink-0 border-r border-slate-800 select-none"
        aria-label="Navegación principal del ERP"
      >
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/30 text-lg" aria-hidden="true">
            E
          </div>
          <span className="font-bold text-white text-lg tracking-tight">System</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Módulos del sistema">
          {MAIN_MODULES.map((item) => {
            const Icon = item.icon;
            const isCxc = item.id === 'cuentas_cobrar';

            if (!isCxc) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-150 group"
                  aria-label={`Ir a ${item.label}`}
                >
                  <Icon size={18} className="text-slate-400 group-hover:text-slate-200" aria-hidden="true" />
                  <span className="truncate flex-1 text-left">{item.label}</span>
                </button>
              );
            }

            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setCxcOpen((value) => !value)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group bg-slate-800 text-white shadow-sm border border-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-expanded={cxcOpen}
                  aria-controls="cxc-navigation-groups"
                >
                  <Icon size={18} className="text-blue-500" aria-hidden="true" />
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  {cxcOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                </button>

                {cxcOpen && (
                  <div id="cxc-navigation-groups" className="mt-1 ml-3 pl-3 border-l border-slate-700/70 space-y-1">
                    <button
                      type="button"
                      onClick={() => navigate(CXC_DASHBOARD_PATH)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isDashboardActive
                          ? 'text-blue-300 bg-slate-800/80'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                      }`}
                      aria-current={isDashboardActive ? 'page' : undefined}
                    >
                      <LayoutDashboard size={15} aria-hidden="true" />
                      <span className="flex-1 text-left">Dashboard</span>
                    </button>

                    {CXC_GROUPS.map((group) => {
                      const GroupIcon = group.icon;
                      const groupActive = activeGroup?.id === group.id;
                      const expanded = Boolean(openGroups[group.id]);
                      const regionId = `cxc-group-${group.id}`;

                      return (
                        <div key={group.id}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              groupActive
                                ? 'text-blue-300 bg-slate-800/80'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                            }`}
                            aria-expanded={expanded}
                            aria-controls={regionId}
                          >
                            <GroupIcon size={15} aria-hidden="true" />
                            <span className="flex-1 text-left">{group.label}</span>
                            {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                          </button>

                          {expanded && (
                            <div id={regionId} className="ml-4 mt-0.5 space-y-0.5">
                              {group.items.map((subItem) => {
                                const subActive = isSubItemActive(subItem);
                                return (
                                  <button
                                    key={subItem.id}
                                    type="button"
                                    onClick={() => navigate(subItem.path)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                      subActive
                                        ? 'bg-blue-600/15 text-blue-300 font-semibold'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                    }`}
                                    aria-current={subActive ? 'page' : undefined}
                                  >
                                    {subItem.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/50">
            <div className="w-9 h-9 rounded-full bg-slate-700 text-slate-200 font-semibold flex items-center justify-center text-xs border border-slate-600 shrink-0" aria-hidden="true">
              ER
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">Eduardo Ruiz</p>
              <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">Director de Compras</p>
            </div>
            <LogOut size={16} className="text-slate-500" aria-hidden="true" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center" aria-label="Contexto de navegación">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Cuentas por Cobrar</p>
            <h2 className="text-sm font-semibold text-slate-800 truncate">
              {isDashboardActive ? 'Dashboard' : activeGroup?.label}
            </h2>
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto p-6 bg-slate-50" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
};
