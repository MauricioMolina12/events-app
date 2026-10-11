# 0001 — La sesión vive en una cookie `HttpOnly`, nunca en JavaScript

- **Estado:** aceptada
- **Contexto:** `events-api` expone una API `admin`/`public` que se consume desde un
  navegador y desde un panel de operadores.

## Contexto

El cliente necesita autenticarse contra `events-api`. Las alternativas típicas son:
guardar un bearer token en `localStorage`/`sessionStorage`, guardar un token en memoria
y reenviarlo en cada petición, o delegar la sesión al navegador mediante una cookie.

Cualquier token accesible desde JavaScript es también accesible para cualquier script
que llegue a ejecutarse en la página (XSS → robo de sesión persistente). La API ya
emite la sesión como cookie y no ofrece un token legible por el cliente.

## Decisión

La sesión se maneja **exclusivamente** con una cookie `HttpOnly` (y `SameSite=Lax`) que
emite `events-api`. El frontend por lo tanto:

1. **No** guarda tokens: `environment.apiBaseUrl` es el único ajuste de endpoint
   (ver `src/app/core/config/environment.ts`).
2. Envía credenciales en todas las peticiones: el `HttpClient` se configura con
   `withFetch()` y el `baseUrlInterceptor` añade `withCredentials: true`
   (`src/app/core/http/`).
3. Considera la sesión como **estado reflejado**, no propio: `SessionStore`
   (`src/app/core/auth/session-store.ts`) hidrata desde `GET /auth/me`, distingue
   `unknown` de `anonymous` y **no** persiste nada.
4. Reacciona a un `401` **solo cuando había sesión**: con el usuario autenticado, un
   `SESSION_EXPIRED`/`SESSION_REVOKED` limpia el estado y redirige a
   `/panel/login?returnUrl=…` (una sola redirección en vuelo), en lugar de intentar
   refrescar un token. El `401` del sondeo anónimo (`GET /auth/me` en el arranque) **no**
   redirige: es "no hay sesión", no "la sesión murió", así que un visitante público nunca
   ve el panel interno.

## Consecuencias

- **Positivas:** un XSS no puede leer la sesión; no hay `localStorage` que limpiar ni
  token que rotar en el cliente; el logout es una llamada al servidor.
- **Positivas:** el panel puede asumir que la sesión viaja igual en cada petición
  (`admin` y `public`), sin cabeceras condicionales repartidas por el código.
- **Coste:** la cookie sólo viaja si el navegador considera el destino _same-site_;
  esto obliga a la decisión de despliegue de [ADR 0002](./0002-hosting-same-site.md).
- **Coste:** el estado de sesión arranca como `unknown`; los guards deben esperar a
  `status !== 'unknown'` en lugar de asumir "anónimo" durante el arranque.
- **Coste:** no hay soporte para clientes sin cookies (un futuro móvil nativo
  necesitaría un mecanismo aparte, evaluado en su propio ADR).
