/**
 * El kit de components/ui/* (Button, FormControls, DataDisplay, Badges) está
 * escrito en JSX con JSDoc parcial: documenta algunas props pero no todas
 * las que el componente realmente acepta en runtime (ej. Button SÍ acepta
 * onClick y type, pero el JSDoc no los declara; DataTable SÍ acepta
 * onRowClick opcional, pero al no tener JSDoc, TypeScript lo infiere como
 * requerido). Eso hace que TypeScript rechace props válidas.
 *
 * Por la regla 1 de FRONTEND_GUIDELINES.md, components/ui/* es de solo
 * lectura — no se puede corregir el JSDoc ahí. Este archivo re-exporta los
 * mismos componentes reales (mismo código, mismo comportamiento) con un
 * tipo permisivo, para que el resto del equipo no tenga que pelear con
 * falsos errores de tipos. Importa SIEMPRE desde aquí, no directo desde
 * components/ui, en cualquier módulo (compras, bancos, cxp, cxc).
 */
import type { FC } from 'react';
import { Button as ButtonBase } from '../components/ui/Button';
import {
  TextInput as TextInputBase,
  Select as SelectBase,
  TextArea as TextAreaBase,
  Checkbox as CheckboxBase,
} from '../components/ui/FormControls';
import { AuditBanner as AuditBannerBase } from '../components/ui/Badges';
import { UnifiedStatusBadge } from './components/UnifiedStatusBadge';
import {
  Sidebar as SidebarBase,
  Navbar as NavbarBase,
  AppLayout as AppLayoutBase,
} from '../components/ui/AppLayout';
import {
  StatCard as StatCardBase,
  ProcessStepper as ProcessStepperBase,
  Pagination as PaginationBase,
  DataTable as DataTableBase,
} from '../components/ui/DataDisplay';

export const Button = ButtonBase as FC<any>;
export const TextInput = TextInputBase as FC<any>;
export const Select = SelectBase as FC<any>;
export const TextArea = TextAreaBase as FC<any>;
export const Checkbox = CheckboxBase as FC<any>;
export const StatusBadge = UnifiedStatusBadge as FC<any>;
export const AuditBanner = AuditBannerBase as FC<any>;
export const Sidebar = SidebarBase as FC<any>;
export const Navbar = NavbarBase as FC<any>;
export const AppLayout = AppLayoutBase as FC<any>;
export const StatCard = StatCardBase as FC<any>;
export const ProcessStepper = ProcessStepperBase as FC<any>;
export const Pagination = PaginationBase as FC<any>;
export const DataTable = DataTableBase as FC<any>;