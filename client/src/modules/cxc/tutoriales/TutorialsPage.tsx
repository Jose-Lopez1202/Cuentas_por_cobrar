import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Play, RotateCcw } from 'lucide-react';
import { TUTORIALS, TUTORIAL_GROUPS } from './tutorialsData';
import { getCompleted, resetCompleted } from './tutorialProgress';

export const START_TUTORIAL_STATE_KEY = 'startTutorial';

export const TutorialsPage = () => {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>(() => getCompleted());

  const sections = useMemo(
    () =>
      TUTORIAL_GROUPS.map((group) => ({
        ...group,
        tutorials: TUTORIALS.filter((t) => t.group === group.id),
      })).filter((section) => section.tutorials.length > 0),
    [],
  );

  const total = TUTORIALS.length;
  const done = TUTORIALS.filter((t) => completed.includes(t.id)).length;

  const start = (id: string, path: string) => {
    navigate(path, { state: { [START_TUTORIAL_STATE_KEY]: id } });
  };

  const reset = () => {
    resetCompleted();
    setCompleted([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tutoriales guiados</h1>
          <p className="text-sm text-slate-500">
            Recorridos paso a paso de cada pantalla de Cuentas por Cobrar. También puedes lanzarlos con el botón «Tutorial» dentro de cada pantalla.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-slate-500">
            <span className="font-semibold text-slate-900">{done}</span> de {total} completados
          </span>
          {done > 0 && (
            <button
              type="button"
              onClick={reset}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Reiniciar progreso
            </button>
          )}
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`tut-group-${section.id}`} className="space-y-3">
          <h2 id={`tut-group-${section.id}`} className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {section.label}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {section.tutorials.map((tutorial) => {
              const isDone = completed.includes(tutorial.id);
              const needsRecord = Boolean(tutorial.pathPattern);
              return (
                <article
                  key={tutorial.id}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{tutorial.title}</h3>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0">
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Completado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{tutorial.summary}</p>
                    <p className="mt-2 text-xs text-slate-400">{tutorial.steps.length} pasos</p>
                  </div>

                  {needsRecord ? (
                    <p className="text-xs text-slate-500">
                      Se inicia con el botón «Tutorial» al abrir un registro desde su listado.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => start(tutorial.id, tutorial.path)}
                      className="h-9 px-3 self-start inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      <Play size={14} aria-hidden="true" />
                      {isDone ? 'Repetir' : 'Iniciar'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
