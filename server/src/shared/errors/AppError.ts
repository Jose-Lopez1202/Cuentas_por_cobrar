/**
 * Jerarquía de errores de aplicación.
 *
 * Los servicios expresan intención de dominio (404/409/etc.) sin conocer
 * Express. El middleware HTTP es el único responsable de convertir estos
 * objetos en respuestas. Esto mantiene separación de responsabilidades y
 * permite reutilizar la lógica desde pruebas, jobs o futuras interfaces.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly expose = true,
    public readonly details?: Array<{ campo: string; mensaje: string }>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

/** Rechazo del certificador simulado (SAT): 400 con el detalle por campo para el formulario. */
export class SatRechazoError extends AppError {
  constructor(errores: Array<{ codigo: string; campo: string; mensaje: string }>) {
    super(
      `La SAT (simulada) rechazó el documento: ${errores.map((e) => e.mensaje).join(' ')}`,
      400,
      'SAT_RECHAZO',
      true,
      errores.map((e) => ({ campo: e.campo, mensaje: `[${e.codigo}] ${e.mensaje}` })),
    );
  }
}
