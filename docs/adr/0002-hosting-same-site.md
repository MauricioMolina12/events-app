# 0002 — El frontend se despliega _same-site_ con la API

- **Estado:** aceptada
- **Referenciado desde:** `src/app/core/config/environment.production.ts`

## Contexto

La sesión es una cookie `HttpOnly` con `SameSite=Lax` ([ADR 0001](./0001-session-in-httponly-cookie.md)).
`SameSite=Lax` — y sobre todo `Secure` — significa que el navegador sólo adjunta la
cookie cuando la petición es _same-site_ respecto del origen de la página. Un frontend
en `https://eventos.example` llamando a `https://api.otro-dominio.example` produce
peticiones _cross-site_: la cookie no viaja, todas las llamadas vuelven `401` y el
usuario ve un login que "no hace nada".

`api.otro-dominio.example` sólo se consideraría _same-site_ si compartiera el dominio
registrable (`example`), porque el criterio del navegador es el registrable domain y no
el host exacto.

## Decisión

En producción el frontend y la API se sirven desde **el mismo sitio**, y la aplicación
habla con rutas relativas:

- `apiBaseUrl` es `/api/v1` en todos los entornos
  (`src/app/core/config/environment.ts` y `environment.production.ts`).
- El edge worker / reverse proxy enruta `/api/*` hacia `events-api` y todo lo demás
  hacia los estáticos de la PWA (`dist/events-f/browser`).
- Un `apiBaseUrl` absoluto sólo se acepta si comparte el dominio registrable del
  frontend (por ejemplo `https://eventos.example` + `https://api.example`).
- El proxy de desarrollo (`proxy.conf.json` → `http://localhost:8787`) reproduce esa
  misma forma: en `ng serve` el navegador ve un único origen.

## Consecuencias

- **Positivas:** la cookie de sesión viaja sin configuración extra y sin CORS con
  credenciales; no hace falta preflight ni `Access-Control-Allow-Credentials`.
- **Positivas:** el service worker puede cachear `/api/v1/public/events**` (ver
  `ngsw-config.json`) sin mezclarse con tráfico de otros orígenes.
- **Coste:** no se puede desplegar el frontend en un dominio completamente distinto al
  de la API sin cambiar antes de estrategia de sesión; el comentario de
  `environment.production.ts` lo dejó escrito para que el error sea evidente.
- **Coste:** el despliegue necesita un componente que enrute por path (edge worker,
  nginx o equivalente); publicar sólo los estáticos en un CDN no es suficiente.
