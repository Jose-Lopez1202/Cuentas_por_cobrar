import { CxcAppLayout } from '../shared/CxcAppLayout';

interface CreditoLayoutProps {
  children: React.ReactNode;
}

export const CreditoLayout = ({ children }: CreditoLayoutProps) => (
  <CxcAppLayout>{children}</CxcAppLayout>
);
