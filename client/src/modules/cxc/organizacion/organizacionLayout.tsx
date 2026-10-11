import type { ReactNode } from 'react';
import { CxcAppLayout } from '../shared/CxcAppLayout';

interface OrganizacionLayoutProps {
  children: ReactNode;
}

export const OrganizacionLayout = ({ children }: OrganizacionLayoutProps) => (
  <CxcAppLayout>{children}</CxcAppLayout>
);