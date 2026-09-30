import { CxcAppLayout } from '../shared/CxcAppLayout';

interface CobranzaLayoutProps {
  children: React.ReactNode;
}

export const CobranzaLayout = ({ children }: CobranzaLayoutProps) => (
  <CxcAppLayout>{children}</CxcAppLayout>
);
