import { CxcAppLayout } from '../shared/CxcAppLayout';

interface OrganizacionLayoutProps {
  children: React.ReactNode;
}

export const OrganizacionLayout = ({ children }: OrganizacionLayoutProps) => (
  <CxcAppLayout>{children}</CxcAppLayout>
);
