import React, { useMemo, useState } from 'react';
import {
  ROLES, ROL_LABEL, crearUsuarioSchema, editarUsuarioSchema,
  type UsuarioAdmin, type UsuarioCreado,
} from '@erp/contracts';
import { TextInput, Select } from '../../../shared/ui-kit';
import { FormActionButtons } from '../../../shared/components/FormActionButtons';
import { apiClient, ApiError } from '../../../shared/api';
import { hasErrors, type ValidationErrors } from '../../../shared/validation';

const AYUDA_ROL: Record<string, string> = {
  ADMIN: 'Acceso total, incluida la administración de usuarios.',
  OPERADOR: 'Puede consultar y registrar información en Cuentas por Cobrar.',
  CONSULTA: 'Solo puede consultar: el sistema rechaza cualquier alta, cambio o baja.',
};

/**
 * Alta y edición de usuarios. Las reglas (usuario, nombre, correo, rol) vienen del mismo
 * esquema compartido que valida el servidor, así el mensaje es idéntico en ambos lados.
 */
export function UsuarioForm({ item, esPropio, onCreated, onUpdated, onCancel }: {
  item?: UsuarioAdmin | null;
  /** true si el administrador se edita a sí mismo: no puede cambiar su rol ni su estado. */
  esPropio?: boolean;
  onCreated: (r: UsuarioCreado) => void;
  onUpdated: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(item);
  const [username, setUsername] = useState(item?.username ?? '');
  const [nombre, setNombre] = useState(item?.nombre ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [rol, setRol] = useState<string>(item?.rol ?? 'OPERADOR');
  const [estado, setEstado] = useState<string>(item?.estado ?? 'ACTIVO');
  const [serverErrors, setServerErrors] = useState<ValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tocados, setTocados] = useState<Record<string, boolean>>({});

  const validationErrors = useMemo<ValidationErrors>(() => {
    const parsed = isEditing
      ? editarUsuarioSchema.safeParse({ nombre, email, rol, estado })
      : crearUsuarioSchema.safeParse({ username, nombre, email, rol });
    const next: ValidationErrors = {};
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => { const k = String(i.path[0]); if (!next[k]) next[k] = i.message; });
    }
    // Los campos de texto vacíos se explican con un mensaje más claro que el del esquema.
    if (!isEditing && !username.trim()) next.username = 'El usuario es obligatorio.';
    if (!nombre.trim()) next.nombre = 'El nombre completo es obligatorio.';
    return next;
  }, [isEditing, username, nombre, email, rol, estado]);

  const isFormValid = !hasErrors(validationErrors);
  const marcar = (campo: string) => setTocados((t) => ({ ...t, [campo]: true }));
  const errorDe = (campo: string) => serverErrors[campo] ?? (tocados[campo] || serverErrors[campo] ? validationErrors[campo] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isFormValid) {
      setTocados({ username: true, nombre: true, email: true, rol: true, estado: true });
      return;
    }
    setServerErrors({});
    setBusy(true);
    try {
      if (isEditing) {
        await apiClient.patch(`/admin/usuarios/${item!.idUsuario}`, { nombre: nombre.trim(), email: email.trim(), rol, estado }, { successMessage: 'Usuario actualizado correctamente.' });
        onUpdated();
      } else {
        const r = await apiClient.post<UsuarioCreado>('/admin/usuarios', { username: username.trim(), nombre: nombre.trim(), email: email.trim(), rol }, { successMessage: 'Usuario creado correctamente.' });
        onCreated(r);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && Array.isArray(err.details)) {
        const x: ValidationErrors = {};
        (err.details as Array<{ campo: string; mensaje: string }>).forEach((d) => { x[d.campo] = d.mensaje; });
        setServerErrors(x);
      } else {
        setFormError(err instanceof ApiError ? err.message : 'No se pudo guardar el usuario.');
      }
    } finally {
      setBusy(false);
    }
  };

  const limpiar = (campo: string) => setServerErrors((s) => { if (!s[campo]) return s; const { [campo]: _omit, ...resto } = s; return resto; });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <TextInput
        label="Usuario"
        required
        maxLength={50}
        autoComplete="off"
        disabled={isEditing}
        helperText={isEditing ? 'El nombre de usuario no se puede cambiar.' : 'Con él iniciará sesión: 3 a 50 caracteres, solo letras, números, punto, guion y guion bajo.'}
        value={username}
        onChange={(e: any) => { setUsername(e.target.value.replace(/\s/g, '')); limpiar('username'); }}
        onBlur={() => marcar('username')}
        error={errorDe('username')}
      />
      <TextInput
        label="Nombre completo"
        required
        maxLength={120}
        helperText="Nombre que se mostrará en el menú y en la bitácora."
        value={nombre}
        onChange={(e: any) => { setNombre(e.target.value); limpiar('nombre'); }}
        onBlur={() => marcar('nombre')}
        error={errorDe('nombre')}
      />
      <TextInput
        label="Correo electrónico"
        type="email"
        maxLength={150}
        helperText="Recomendado: con este correo el usuario podrá recuperar su contraseña por sí mismo."
        value={email}
        onChange={(e: any) => { setEmail(e.target.value); limpiar('email'); }}
        onBlur={() => marcar('email')}
        error={errorDe('email')}
      />
      <Select
        label="Rol"
        required
        value={rol}
        disabled={esPropio}
        onChange={(e: any) => { setRol(e.target.value); limpiar('rol'); }}
        options={ROLES.map((r) => ({ value: r, label: ROL_LABEL[r] }))}
        helperText={esPropio ? 'No puedes cambiar tu propio rol. Pídelo a otro administrador.' : AYUDA_ROL[rol]}
        error={serverErrors.rol}
      />
      {isEditing && (
        <Select
          label="Estado"
          required
          value={estado}
          disabled={esPropio}
          onChange={(e: any) => { setEstado(e.target.value); limpiar('estado'); }}
          options={[{ value: 'ACTIVO', label: 'Activo' }, { value: 'INACTIVO', label: 'Inactivo' }]}
          helperText={esPropio ? 'No puedes desactivar tu propia cuenta.' : 'Un usuario inactivo no puede iniciar sesión y se cierran sus sesiones abiertas.'}
          error={serverErrors.estado}
        />
      )}
      {!isEditing && (
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Al guardar, el sistema genera una <strong>contraseña temporal</strong> que verás una sola vez.
          El usuario deberá cambiarla en su primer ingreso.
        </p>
      )}

      {formError && <p role="alert" className="text-sm text-red-600 font-medium">{formError}</p>}

      <FormActionButtons
        onCancel={onCancel}
        isSubmitting={busy}
        isEditing={isEditing}
        isFormValid={isFormValid}
        blockers={validationErrors}
        createLabel="Crear usuario"
        confirmTitle={isEditing ? 'Confirmar cambios' : 'Confirmar nuevo usuario'}
        confirmMessage={isEditing
          ? 'Si cambias el rol o desactivas la cuenta, se cerrarán sus sesiones abiertas. ¿Guardar los cambios?'
          : '¿Crear este usuario? Se generará una contraseña temporal.'}
      />
    </form>
  );
}
