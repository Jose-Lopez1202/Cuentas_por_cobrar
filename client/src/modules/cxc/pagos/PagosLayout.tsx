import { CxcAppLayout } from '../shared/CxcAppLayout';

interface PagosLayoutProps {
  children: React.ReactNode;
}

export const PagosLayout = ({ children }: PagosLayoutProps) => (
  <CxcAppLayout>{children}</CxcAppLayout>
);
