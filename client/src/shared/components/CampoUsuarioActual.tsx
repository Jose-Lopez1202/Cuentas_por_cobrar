import { UserRound } from 'lucide-react';
import { TextInput } from '../ui-kit';
import { useAuth } from '../auth/AuthContext';

interface CampoUsuarioActualProps {
  label?: string;
}

/**
 * Muestra, bloqueado, quién está realizando la acción: «usuario (Nombre completo)».
 * Es solo informativo: el servidor toma al responsable del token de sesión y
 * descarta cualquier valor que llegue en la petición, así que no hay nada que
 * elegir ni que se pueda alterar desde la pantalla.
 */
export const CampoUsuarioActual = ({ label = 'Registrado por' }: CampoUsuarioActualProps) => {
  const { usuario } = useAuth();
  const valor = usuario ? `${usuario.username} (${usuario.nombre})` : 'Sin sesión';

  return (
    <TextInput
      label={label}
      icon={UserRound}
      value={valor}
      onChange={() => undefined}
      isReadOnly
      disabled
      helperText="Se asigna automáticamente desde tu sesión y no se puede cambiar."
    />
  );
};
