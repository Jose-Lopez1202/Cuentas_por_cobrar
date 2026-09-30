import { CxcAppLayout } from '../shared/CxcAppLayout';

interface DocumentosLayoutProps {
  children: React.ReactNode;
}

/**
 * El sidebar de CxC es la única navegación del área. Detalle e historial se
 * administran dentro del documento seleccionado, no como catálogos aparte.
 */
export const DocumentosLayout = ({ children }: DocumentosLayoutProps) => (
  <CxcAppLayout>{children}</CxcAppLayout>
);
