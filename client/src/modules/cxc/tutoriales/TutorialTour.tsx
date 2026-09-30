import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Tutorial } from './tutorialTypes';
import { resolveTarget } from './resolveTarget';

interface TutorialTourProps {
  tutorial: Tutorial;
  onClose: (completed: boolean) => void;
}

const POPOVER_WIDTH = 360;
const GAP = 14;
const PAD = 6;
const MARGIN = 12;
// Reintentos mientras la tabla / los datos terminan de cargar.
const RETRY_MS = 150;
const MAX_RETRIES = 10;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const TutorialTour = ({ tutorial, onClose }: TutorialTourProps) => {
  const { steps } = tutorial;
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [popoverHeight, setPopoverHeight] = useState(200);
  const popoverRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el || !el.isConnected) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, []);

  // Localiza el elemento del paso (con reintentos) y lo trae a la vista.
  useEffect(() => {
    targetRef.current = null;
    setBox(null);
    if (!step.target) return;

    let attempts = 0;
    let timer: number | undefined;
    let cancelled = false;

    const find = () => {
      if (cancelled) return;
      const el = resolveTarget(step.target);
      if (el) {
        targetRef.current = el;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        measure();
        // El scroll suave cambia la posición: vuelve a medir al asentarse.
        window.setTimeout(measure, 350);
      } else if (attempts++ < MAX_RETRIES) {
        timer = window.setTimeout(find, RETRY_MS);
      }
    };
    find();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [step, measure]);

  // Mantiene el resaltado pegado al elemento si se hace scroll o cambia el tamaño.
  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useLayoutEffect(() => {
    if (popoverRef.current) setPopoverHeight(popoverRef.current.offsetHeight);
  }, [index, box]);

  const goNext = useCallback(() => {
    if (isLast) onClose(true);
    else setIndex((i) => i + 1);
  }, [isLast, onClose]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    nextRef.current?.focus();
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose(false);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [goNext, goPrev, onClose]);

  // Posición del popover: debajo del elemento; si no cabe, arriba; si no hay elemento, centrado.
  const popoverStyle = (() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPOVER_WIDTH, vw - MARGIN * 2);
    if (!box) {
      return { width, top: Math.max(MARGIN, (vh - popoverHeight) / 2), left: (vw - width) / 2 };
    }
    const below = box.top + box.height + GAP;
    const fitsBelow = below + popoverHeight + MARGIN <= vh;
    const top = fitsBelow ? below : Math.max(MARGIN, box.top - GAP - popoverHeight);
    const left = Math.min(Math.max(MARGIN, box.left), vw - width - MARGIN);
    return { width, top, left };
  })();

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      {/* Bloquea clics en la app durante el tour. */}
      <div className="absolute inset-0" aria-hidden="true" />

      {box ? (
        <div
          className="absolute rounded-lg ring-2 ring-blue-400 pointer-events-none transition-all duration-200"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/55" aria-hidden="true" />
      )}

      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-step-title"
        aria-describedby="tutorial-step-body"
        className="absolute bg-white rounded-xl shadow-xl border border-slate-200 p-5"
        style={popoverStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-600">
            {tutorial.title} · Paso {index + 1} de {steps.length}
          </p>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="p-1 -mt-1 -mr-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="Cerrar tutorial"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <h3 id="tutorial-step-title" className="mt-1.5 text-base font-bold text-slate-900">
          {step.title}
        </h3>
        <p id="tutorial-step-body" className="mt-1.5 text-sm text-slate-600 leading-relaxed">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-200'}`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Omitir
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={goPrev}
                className="h-9 px-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={goNext}
              className="h-9 px-3 inline-flex items-center gap-1 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {isLast ? 'Finalizar' : 'Siguiente'}
              {!isLast && <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
