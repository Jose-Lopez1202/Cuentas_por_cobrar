import { useState } from 'react';
import { KeyRound, LockOpen, LogOut, Pencil, Plus, Search, ShieldCheck } from 'lucide-react';
import { ROL_LABEL, type BitacoraAcceso, type UsuarioAdmin, type UsuarioCreado } from '@erp/contracts';
import { Button, DataTable, TextInput } from '../../shared/ui-kit';
import { ConfirmDialog, Modal } from '../../shared/components';
import { toast } from '../../shared/components/Toast';
import { usePaginatedList } from '../../shared/hooks';
import { apiClient, ApiError } from '../../shared/api';
import { useAuth } from '../../shared/auth/AuthContext';
import { UsuarioForm } from './components/UsuarioForm';
import { ClaveTemporalModal } from './components/ClaveTemporalModal';

type Pestana = 'usuarios' | 'bitacora';
type Accion = { tipo: 'restablecer' | 'sesiones' | 'desbloquear'; usuario: UsuarioAdmin };

const ROL_ESTILO: Record<string, string> = {
  ADMIN: 'bg-violet-50 text-violet-700 ring-violet-200',
  OPERADOR: 'bg-blue-50 text-blue-700 ring-blue-200',
  CONSULTA: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const Chip = ({ children, className }: { children: React.ReactNode; className: string }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}>{children}</span>
);

const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const EVENTOS: Record<string, { texto: string; estilo: string }> = {
  LOGIN_OK: { texto: 'Ingreso correcto', estilo: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  LOGIN_FALLIDO: { texto: 'Ingreso fallido', estilo: 'bg-amber-50 text-amber-800 ring-amber-200' },
  CUENTA_BLOQUEADA: { texto: 'Cuenta bloqueada', estilo: 'bg-red-50 text-red-700 ring-red-200' },
  LOGIN_BLOQUEADO: { texto: 'Intento bloqueado', estilo: 'bg-red-50 text-red-700 ring-red-200' },
  LOGOUT: { texto: 'Cierre de sesión', estilo: 'bg-slate-100 text-slate-700 ring-slate-200' },
  CAMBIO_CLAVE: { texto: 'Cambio de contraseña', estilo: 'bg-blue-50 text-blue-700 ring-blue-200' },
  REFRESH_REUSO: { texto: 'Token reutilizado', estilo: 'bg-red-50 text-red-700 ring-red-200' },
  SESION_EXPIRADA: { texto: 'Sesión expirada', estilo: 'bg-slate-100 text-slate-700 ring-slate-200' },
  USUARIO_CREADO: { texto: 'Usuario creado', estilo: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  USUARIO_MODIFICADO: { texto: 'Usuario modificado', estilo: 'bg-blue-50 text-blue-700 ring-blue-200' },
  CLAVE_RESTABLECIDA: { texto: 'Contraseña restablecida', estilo: 'bg-violet-50 text-violet-700 ring-violet-200' },
  USUARIO_DESBLOQUEADO: { texto: 'Usuario desbloqueado', estilo: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  SESIONES_CERRADAS: { texto: 'Sesiones cerradas', estilo: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

function BotonFila({ titulo, onClick, disabled, children, tono = 'azul' }: {
  titulo: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; tono?: 'azul' | 'rojo';
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={titulo} aria-label={titulo}
      className={`rounded-md p-1.5 text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 ${tono === 'rojo' ? 'hover:text-red-600' : 'hover:text-blue-600'}`}
    >
      {children}
    </button>
  );
}

function TablaUsuarios() {
  const { usuario: yo } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; item?: UsuarioAdmin } | null>(null);
  const [credenciales, setCredenciales] = useState<{ username: string; clave: string; motivo: 'creado' | 'restablecida' } | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const { data, meta, isLoading, error, refetch } = usePaginatedList<UsuarioAdmin>('/admin/usuarios', { page, limit: 10, search });

  const ejecutar = async () => {
    if (!accion) return;
    const { tipo, usuario } = accion;
    setProcesando(true);
    try {
      const base = `/admin/usuarios/${usuario.idUsuario}`;
      if (tipo === 'restablecer') {
        const r = await apiClient.post<{ claveTemporal: string }>(`${base}/restablecer-clave`, {}, { successMessage: 'Contraseña restablecida correctamente.' });
        setCredenciales({ username: usuario.username, clave: r.claveTemporal, motivo: 'restablecida' });
      } else if (tipo === 'sesiones') {
        const r = await apiClient.post<{ cerradas: number }>(`${base}/cerrar-sesiones`, {}, { successMessage: false });
        toast.success(r.cerradas ? `Se cerraron ${r.cerradas} sesión(es) de ${usuario.username}.` : `${usuario.username} no tenía sesiones abiertas.`);
      } else {
        await apiClient.post(`${base}/desbloquear`, {}, { successMessage: `${usuario.username} fue desbloqueado.` });
      }
      setAccion(null);
      refetch();
    } catch (e) {
      // Siempre se explica por qué no se pudo.
      toast.error(e instanceof ApiError ? e.message : 'No se pudo completar la acción. Intenta de nuevo.');
      setAccion(null);
    } finally {
      setProcesando(false);
    }
  };

  const textoAccion = (a: Accion) => {
    const u = a.usuario.username;
    if (a.tipo === 'restablecer') return { titulo: 'Restablecer contraseña', desc: `Se generará una contraseña temporal para ${u} y se cerrarán todas sus sesiones. Deberá cambiarla al ingresar. ¿Continuar?`, label: 'Sí, restablecer', variant: 'primary' as const };
    if (a.tipo === 'sesiones') return { titulo: 'Cerrar sesiones', desc: `${u} tiene ${a.usuario.sesionesActivas} sesión(es) abierta(s). Se cerrarán de inmediato y tendrá que volver a iniciar sesión. ¿Continuar?`, label: 'Sí, cerrar sesiones', variant: 'danger' as const };
    return { titulo: 'Desbloquear cuenta', desc: `${u} podrá volver a intentar iniciar sesión de inmediato. ¿Desbloquear?`, label: 'Sí, desbloquear', variant: 'primary' as const };
  };
  const t = accion ? textoAccion(accion) : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-white p-4 rounded-lg border border-slate-200 flex-1 min-w-[260px]">
          <TextInput icon={Search} placeholder="Buscar por usuario, nombre o correo..." value={search}
            onChange={(e: any) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
        </div>
        <Button icon={Plus} onClick={() => setModal({ mode: 'create' })}>Nuevo usuario</Button>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="No hay usuarios que coincidan con la búsqueda"
        columns={[
          {
            header: 'Usuario',
            cell: ({ row }: { row: UsuarioAdmin }) => (
              <div>
                <p className="font-semibold text-slate-900">{row.nombre}{row.idUsuario === yo?.idUsuario && <span className="ml-1.5 text-[11px] font-medium text-slate-400">(tú)</span>}</p>
                <p className="text-xs text-slate-500">@{row.username}{row.email ? ` · ${row.email}` : ''}</p>
              </div>
            ),
          },
          { header: 'Rol', cell: ({ row }: { row: UsuarioAdmin }) => <Chip className={ROL_ESTILO[row.rol]}>{ROL_LABEL[row.rol]}</Chip> },
          {
            header: 'Estado',
            cell: ({ row }: { row: UsuarioAdmin }) => (
              <div className="flex flex-wrap gap-1">
                {row.estado === 'ACTIVO'
                  ? <Chip className="bg-emerald-50 text-emerald-700 ring-emerald-200">Activo</Chip>
                  : <Chip className="bg-slate-100 text-slate-600 ring-slate-200">Inactivo</Chip>}
                {row.minutosBloqueo > 0 && <Chip className="bg-red-50 text-red-700 ring-red-200">Bloqueado {row.minutosBloqueo} min</Chip>}
                {row.debeCambiarClave && <Chip className="bg-amber-50 text-amber-800 ring-amber-200">Clave temporal</Chip>}
              </div>
            ),
          },
          { header: 'Último ingreso', cell: ({ row }: { row: UsuarioAdmin }) => <span className="text-xs text-slate-600">{row.ultimoLogin ? fechaHora(row.ultimoLogin) : 'Nunca'}</span> },
          { header: 'Sesiones', cell: ({ row }: { row: UsuarioAdmin }) => <span className="text-xs text-slate-600">{row.sesionesActivas}</span> },
          {
            header: '', align: 'right',
            cell: ({ row }: { row: UsuarioAdmin }) => {
              const propio = row.idUsuario === yo?.idUsuario;
              const bloqueado = row.minutosBloqueo > 0 || row.intentosFallidos > 0;
              return (
                <div className="flex justify-end gap-0.5">
                  <BotonFila titulo={`Editar a ${row.username}`} onClick={() => setModal({ mode: 'edit', item: row })}><Pencil size={15} /></BotonFila>
                  <BotonFila
                    titulo={propio ? 'No puedes restablecer tu propia contraseña aquí: usa «Cambiar contraseña» del menú' : row.estado !== 'ACTIVO' ? 'Activa al usuario para restablecer su contraseña' : `Restablecer contraseña de ${row.username}`}
                    disabled={propio || row.estado !== 'ACTIVO'} onClick={() => setAccion({ tipo: 'restablecer', usuario: row })}
                  ><KeyRound size={15} /></BotonFila>
                  {bloqueado && <BotonFila titulo={`Desbloquear a ${row.username}`} onClick={() => setAccion({ tipo: 'desbloquear', usuario: row })}><LockOpen size={15} /></BotonFila>}
                  {row.sesionesActivas > 0 && <BotonFila titulo={`Cerrar las sesiones de ${row.username}`} tono="rojo" onClick={() => setAccion({ tipo: 'sesiones', usuario: row })}><LogOut size={15} /></BotonFila>}
                </div>
              );
            },
          },
        ]}
        paginationProps={{ currentPage: meta.page, totalPages: meta.totalPages, onPageChange: setPage, showingText: `Mostrando ${data.length} de ${meta.total} usuarios` }}
      />

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? `Editar a ${modal.item?.username}` : 'Nuevo usuario'}
        description={modal?.mode === 'edit' ? undefined : 'Crea una cuenta de acceso al sistema.'}>
        {modal && (
          <UsuarioForm
            item={modal.item}
            esPropio={modal.item?.idUsuario === yo?.idUsuario}
            onCancel={() => setModal(null)}
            onUpdated={() => { setModal(null); refetch(); }}
            onCreated={(r: UsuarioCreado) => {
              setModal(null);
              setCredenciales({ username: r.usuario.username, clave: r.claveTemporal, motivo: 'creado' });
              refetch();
            }}
          />
        )}
      </Modal>

      {credenciales && <ClaveTemporalModal {...credenciales} onClose={() => setCredenciales(null)} />}

      <ConfirmDialog
        isOpen={!!accion} onClose={() => setAccion(null)} onConfirm={ejecutar} isLoading={procesando}
        title={t?.titulo ?? ''} description={t?.desc ?? ''} confirmLabel={t?.label} variant={t?.variant}
      />
    </>
  );
}

function TablaBitacora() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, meta, isLoading, error } = usePaginatedList<BitacoraAcceso>('/admin/usuarios/bitacora', { page, limit: 15, search });

  return (
    <>
      <div className="bg-white p-4 rounded-lg border border-slate-200">
        <TextInput icon={Search} placeholder="Buscar por usuario, evento, IP o detalle..." value={search}
          onChange={(e: any) => { setSearch(e.target.value); setPage(1); }} className="max-w-sm" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <DataTable
        isLoading={isLoading}
        data={data}
        emptyText="Aún no hay eventos registrados"
        columns={[
          { header: 'Fecha', cell: ({ row }: { row: BitacoraAcceso }) => <span className="whitespace-nowrap text-xs text-slate-600">{fechaHora(row.fecha)}</span> },
          { header: 'Usuario', cell: ({ row }: { row: BitacoraAcceso }) => <span className="font-medium text-slate-800">{row.username ?? '—'}</span> },
          {
            header: 'Evento',
            cell: ({ row }: { row: BitacoraAcceso }) => {
              const ev = EVENTOS[row.evento];
              return <Chip className={ev?.estilo ?? 'bg-slate-100 text-slate-700 ring-slate-200'}>{ev?.texto ?? row.evento}</Chip>;
            },
          },
          { header: 'Detalle', cell: ({ row }: { row: BitacoraAcceso }) => <span className="text-xs text-slate-600">{row.detalle ?? '—'}</span> },
          { header: 'IP', cell: ({ row }: { row: BitacoraAcceso }) => <span className="font-mono text-xs text-slate-500">{row.ip ?? '—'}</span> },
        ]}
        paginationProps={{ currentPage: meta.page, totalPages: meta.totalPages, onPageChange: setPage, showingText: `Mostrando ${data.length} de ${meta.total} eventos` }}
      />
    </>
  );
}

export const UsuariosPage = () => {
  const [pestana, setPestana] = useState<Pestana>('usuarios');
  const tabs: Array<{ id: Pestana; label: string }> = [
    { id: 'usuarios', label: 'Usuarios' },
    { id: 'bitacora', label: 'Bitácora de accesos' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700" aria-hidden="true"><ShieldCheck size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios y accesos</h1>
          <p className="text-sm text-slate-500">Crea cuentas, asigna roles, restablece contraseñas y revisa la actividad de seguridad.</p>
        </div>
      </div>

      <div role="tablist" aria-label="Secciones de administración" className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id} type="button" role="tab" id={`tab-${tab.id}`} aria-selected={pestana === tab.id} aria-controls={`panel-${tab.id}`}
            onClick={() => setPestana(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${pestana === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`tab-${pestana}`} className="space-y-4">
        {pestana === 'usuarios' ? <TablaUsuarios /> : <TablaBitacora />}
      </div>
    </div>
  );
};
