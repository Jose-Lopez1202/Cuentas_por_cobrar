# CxC — criterios de calidad y buenas prácticas

Este documento resume las reglas aplicadas al módulo de Cuentas por Cobrar para que los nuevos CRUD mantengan el mismo estándar.

## 1. Firmeza (resistencia)

- La validación del navegador mejora la experiencia, pero **el backend sigue siendo la autoridad** mediante los esquemas de `@erp/contracts`.
- Los campos numéricos bloquean letras y notación científica accidental (`e`, `E`, `+`).
- Los formularios requeridos usan también el atributo HTML `required`.
- Los requests tienen timeout para evitar pantallas esperando indefinidamente.
- Las búsquedas paginadas usan debounce y cancelación de requests obsoletos.
- Los errores HTTP se centralizan y no exponen stack traces o SQL al navegador.

## 2. Belleza (UI)

- El sidebar es la fuente única de navegación de CxC; se eliminó la navegación superior duplicada.
- `Documento Detalle` y `Documento Historial` no aparecen como catálogos: se administran dentro del documento padre.
- El contenido mantiene jerarquía visual consistente, espaciado y estados de foco visibles.
- Los hints se muestran debajo de controles con un estilo uniforme y discreto.

## 3. Utilidad y propósito (UX)

- Cada control comunica qué dato espera mediante label, placeholder y/o hint.
- `Select` se usa para relaciones y valores controlados cuando existe catálogo.
- Campos dependientes se habilitan solo cuando existe su padre (ej. documento después de seleccionar cliente).
- Los campos numéricos usan teclado numérico en móvil; decimales permiten punto o coma y se normalizan.
- Los límites de caracteres visibles coinciden con las restricciones del contrato en los formularios reforzados.

## 4. Accesibilidad

- Inputs, selects y textareas relacionan label, hint y error con `aria-describedby`.
- Los errores exponen `aria-invalid` y `role="alert"`.
- Los campos requeridos exponen `aria-required`.
- Los menús desplegables usan `aria-expanded`, `aria-controls` y `aria-current`.
- Los modales controlan foco: Escape cierra, Tab queda dentro y el foco vuelve al control que abrió el modal.
- Se mantienen estilos `focus-visible` para navegación por teclado.

## 5. Rendimiento

- `usePaginatedList` aplica debounce de 300 ms a búsquedas para no consultar Oracle por cada tecla.
- Se cancelan peticiones anteriores al cambiar página o filtro.
- El cliente API centraliza timeout y evita caché para datos financieros.
- El backend conserva pool de conexiones Oracle y cierre explícito de conexiones por repositorio.

## 6. Seguridad y privacidad

- CORS usa lista de orígenes permitidos configurable mediante `CORS_ORIGINS`.
- Se limita el tamaño de JSON/form bodies a 1 MB.
- Se deshabilita `X-Powered-By` y se agregan cabeceras defensivas básicas.
- La API CxC responde con `Cache-Control: no-store`.
- El log de Oracle ya no imprime el connection string completo.
- Los repositorios continúan usando binds de Oracle; nunca concatenar valores del usuario dentro del SQL.
- `.env` no debe versionarse ni compartirse en el ZIP del proyecto.

## 7. Escalabilidad y mantenibilidad

La separación recomendada es:

`route -> controller -> service -> repository -> Oracle`

- **Route:** define URL y verbo HTTP.
- **Controller:** traduce HTTP a llamadas de aplicación.
- **Service:** aplica reglas de negocio y validación.
- **Repository:** concentra SQL y acceso a datos.
- **Contracts:** define tipos y esquemas compartidos.
- **Shared UI / hooks:** evita repetir controles, modales, validaciones y lógica de listados.

No colocar SQL en controladores ni lógica de negocio en componentes React.

## 8. POO / SOLID aplicada sin forzar clases innecesarias

TypeScript/React no requiere convertir todo a clases. Se aplican principios de POO donde agregan valor:

- `AppError` encapsula comportamiento común y las clases `NotFoundError`, `ConflictError` y `BadRequestError` especializan el error (herencia/polimorfismo).
- Responsabilidad única: controller, service y repository están separados.
- Código reutilizable: controles, modal, API client, validadores y hook de paginación se centralizan.
- Dependencias de infraestructura (Oracle/HTTP) permanecen fuera de la lógica de interfaz.

## 9. Reglas para inputs nuevos

- Cantidades, IDs, días, correlativos: entero.
- Montos, tasas, saldos, precios: decimal no negativo salvo regla explícita.
- Códigos, NIT, series y referencias: `restriction="alphanumeric"` más `maxLength` del contrato.
- Nombres exclusivamente alfabéticos: `restriction="letters"` solo cuando el dominio realmente no admite números.
- Descripciones/observaciones: texto libre con `maxLength` y hint.
- Fechas: `type="date"` y validación de rango cuando aplique.
- Estados con conjunto conocido: preferir `Select` antes que texto libre.

## 10. Validación QA mínima por CRUD

1. Crear registro válido.
2. Intentar guardar obligatorios vacíos.
3. Probar letras en campo numérico y números/caracteres inválidos en campos restringidos.
4. Probar límites de longitud.
5. Editar y confirmar persistencia.
6. Eliminar con confirmación.
7. Buscar y paginar.
8. Probar navegación solo con teclado.
9. Simular backend apagado/timeout y verificar mensaje entendible.
10. Confirmar que ningún error muestre credenciales, SQL o stack trace.


## Acciones de formularios

Todos los formularios CxC deben usar `FormActionButtons`: **Cancelar** en rojo con icono X y **Guardar/Crear** con icono de disquete. El botón de guardado permanece azul mientras falten campos obligatorios y cambia a verde cuando el formulario está completo. Esta señal visual no sustituye las validaciones de negocio del frontend ni del backend.
