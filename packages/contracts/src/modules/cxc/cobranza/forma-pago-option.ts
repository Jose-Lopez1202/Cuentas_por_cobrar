// Forma extendida de CatalogoOption, específica para el select de "Forma de
// pago": incluye si esa forma requiere número de referencia, para que el
// frontend pueda hacer el campo "Referencia" obligatorio condicionalmente.
export interface FormaPagoOption {
  id: number;
  label: string;
  requiereReferencia: boolean;
}