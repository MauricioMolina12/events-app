# 0003 — La inscripción pública tiene una puerta corta (`/inscripcion`)

- **Estado:** aceptada
- **Referenciado desde:** `src/app/app.routes.ts`, `src/app/features/catalog/registration-entry-page/`

## Contexto

El alta vivía en una sola dirección: `/eventos/:slug/inscripcion?sede=<id>`. Es correcta para
navegar — el detalle del evento es quien ofrece el botón — pero mala para **compartir**: quien
invita por WhatsApp o por correo tendría que explicar un slug, y quien recibe el mensaje
tendría que empezar por el catálogo para llegar al formulario.

Tres condiciones complican un enlace corto:

1. `/inscripcion/:folio` ya está ocupado por el comprobante, así que `/inscripcion/<algo>` no
   puede significar a la vez "evento" y "folio".
2. El catálogo admite varios eventos y varias sedes, y el aforo y la ventana viven en la
   participación, no en el evento.
3. El enlace tiene que abrirse desde un móvil, sin sesión y sin haber visitado el sitio antes.

## Decisión

`/inscripcion` es una **puerta pública** que resuelve el destino y cede el paso al formulario
canónico en lugar de duplicarlo:

- `?evento=<slug>` nombra el evento y `?sede=<id>` nombra la sede; ambos son opcionales.
- Sin parámetros se consulta el catálogo (`GET /public/events`).
- Solo redirige (con `replaceUrl`, para que "atrás" no vuelva a la puerta) cuando la respuesta
  es **inequívoca**: la sede que el enlace nombró, o la única sede que puede inscribir ahora.
- Con varios candidatos muestra un selector evento → sede con cupo, ventana y el motivo del
  bloqueo: elegir por la persona la inscribiría en la sede equivocada.
- Sin candidatos explica el estado (cerrada, fuera de ventana, aforo agotado) y enlaza al
  catálogo; un slug que ya no existe cae en el estado de "no encontrado".
- La ruta no lleva guard: el catálogo y el alta son la superficie anónima de la API.

`/eventos/:slug/inscripcion` es la dirección **canónica** (limpia, sin query string): es la que
usan el detalle del evento y a la que la puerta redirige. La sede viaja por debajo, en el
estado de navegación (`state`), nunca en la URL, así que un enlace compartido no expone el id
de la participación.

## Consecuencias

- **Positivas:** un solo enlace corto y recordable por jornada, que se puede pegar en cualquier
  medio y funciona sin sesión.
- **Positivas:** el formulario no se duplica; la puerta solo enruta y reutiliza el catálogo.
- **Positivas:** la regla de "esta sede puede inscribir" quedó en un único módulo
  (`participation-availability.ts`), compartido por el detalle del evento, el formulario y la
  puerta, así que ninguna pantalla puede ofrecer un alta que otra rechace.
- **Coste:** la sede ya no es direccionable por URL: una recarga preselecciona la primera sede
  abierta (el selector del formulario sigue permitiendo cambiarla).
- **Coste:** una pantalla más que mantener; el criterio de "inequívoco" está cubierto por tests
  (unitarios y e2e) precisamente porque cambiarlo mueve a dónde llega un enlace ya compartido.
- **Coste:** depende del enrutado por path del ADR 0002 (deep links): publicar solo los
  estáticos no basta.
