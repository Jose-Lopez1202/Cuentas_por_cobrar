import React from 'react';

interface Props { children: React.ReactNode }
interface State { hasError: boolean }

/**
 * Barrera de último recurso para que un error inesperado de renderizado no
 * deje toda la aplicación en blanco. Los errores de API se manejan cerca del
 * formulario/listado; esta clase cubre fallos no previstos de React.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // No se muestran detalles técnicos al usuario. En producción este punto
    // puede conectarse a una herramienta de observabilidad.
    console.error('[CXC UI] Error inesperado de renderizado', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6" role="alert">
        <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
          <h1 className="text-xl font-bold text-slate-900">No pudimos mostrar esta pantalla</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ocurrió un error inesperado. Tus datos no se enviaron nuevamente de forma automática.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Recargar pantalla
          </button>
        </section>
      </main>
    );
  }
}
