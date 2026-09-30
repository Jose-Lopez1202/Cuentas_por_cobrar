import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ComponentShowcase } from '../components/ui/ComponentShowcase';
import { routes } from './routes';
import { AppErrorBoundary } from '../shared/components';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/cxc/documentos/documentos" replace /> },
  { path: '/ui-kit', element: <ComponentShowcase /> },
  ...routes,
  {
    path: '*',
    element: (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <section className="max-w-lg text-center">
          <p className="text-sm font-semibold text-blue-600">404</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Página no encontrada</h1>
          <p className="mt-2 text-sm text-slate-600">La dirección no corresponde a una pantalla disponible del ERP.</p>
          <a href="/" className="mt-5 inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Volver a Cuentas por Cobrar</a>
        </section>
      </main>
    ),
  },
]);

export default function App() {
  return (
    <AppErrorBoundary>
      <div className="erp-app min-h-screen bg-slate-50">
        <RouterProvider router={router} />
      </div>
    </AppErrorBoundary>
  );
}
