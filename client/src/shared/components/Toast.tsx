import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const TOAST_EVENT = 'erp:toast';
const MAX_VISIBLE = 4;
const DURATION_MS: Record<ToastTone, number> = { success: 4000, info: 4000, error: 6000 };

const emit = (tone: ToastTone, message: string) =>
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { tone, message } }));

/** Disponible en cualquier parte (también fuera de componentes, ej. apiClient). */
export const toast = {
  success: (message: string) => emit('success', message),
  error: (message: string) => emit('error', message),
  info: (message: string) => emit('info', message),
};

const TONE_STYLES: Record<ToastTone, { box: string; icon: typeof Info }> = {
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: CheckCircle2 },
  error: { box: 'bg-red-50 border-red-200 text-red-900', icon: AlertCircle },
  info: { box: 'bg-blue-50 border-blue-200 text-blue-900', icon: Info },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());

  const dismiss = (id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  };

  useEffect(() => {
    const activeTimers = timers.current;
    const onToast = (event: Event) => {
      const { tone, message } = (event as CustomEvent<{ tone: ToastTone; message: string }>).detail;
      const id = nextId.current++;
      setItems((current) => [...current, { id, tone, message }].slice(-MAX_VISIBLE));
      activeTimers.set(
        id,
        window.setTimeout(() => {
          activeTimers.delete(id);
          setItems((current) => current.filter((item) => item.id !== id));
        }, DURATION_MS[tone]),
      );
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  return (
    <>
      {children}
      <div
        className="fixed top-4 right-4 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {items.map(({ id, tone, message }) => {
          const { box, icon: Icon } = TONE_STYLES[tone];
          return (
            <div
              key={id}
              role={tone === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg ${box}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm font-medium">{message}</p>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Cerrar notificación"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
};
