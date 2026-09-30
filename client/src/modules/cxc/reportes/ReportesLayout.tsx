import type { ReactNode } from 'react';
import { CxcAppLayout } from '../shared/CxcAppLayout';

interface ReportesLayoutProps {
  children: ReactNode;
}

export const ReportesLayout = ({ children }: ReportesLayoutProps) => (
  <CxcAppLayout>{children}</CxcAppLayout>
);
