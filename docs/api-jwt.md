# API REST con JWT — Guía de consumo

La web sigue usando la sesión (cookie). Los endpoints bajo `/api` se consumen con **JWT**:

```
Authorization: Bearer <token>
```

## Configuración (`.env`, nunca en Git)

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Clave para firmar los tokens (HS256), **mínimo 32 caracteres**. Si falta, el servidor usa una clave temporal y los tokens dejan de servir al reiniciar. |
| `JWT_EXPIRES_IN` | Opcional. Duración del token: `2h` (por defecto), `30m`, `1d`… |
| `PDF_CJK_FONT` | Opcional. Ruta a una fuente china (.ttf/.otf/.ttc) para el PDF en chino. En Windows se usa Microsoft YaHei automáticamente. |

Generar una clave: `bun -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## Endpoints

| Método | Ruta | Protección | Descripción |
|---|---|---|---|
| GET | `/api/health` | Pública | Estado del servicio |
| POST | `/api/auth/login` | Pública | `{ "nickname", "password" }` → token |
| GET | `/api/auth/me` | JWT | Datos del usuario del token |
| POST | `/api/auth/logout` | JWT | Invalida el token |
| GET | `/api/analysis/languages` | JWT + permiso *analisis* | Idiomas disponibles |
| POST | `/api/analysis` | JWT + permiso *analisis* | Análisis léxico → JSON |
| POST | `/api/analysis/report` | JWT + permiso *analisis* | Análisis léxico → PDF |
| GET | `/api/audit/logins` | JWT + rol **ADMIN** | Bitácora de accesos (filtros: `usuario`, `metodo`, `resultado=ok\|fallido`, `limite`) |
| GET | `/api/audit/whatsapp` | JWT + rol **ADMIN** | Envíos de WhatsApp y su estado de entrega (webhook de Wawp, sin polling) |

El análisis acepta:
- **JSON:** `{ "language": "es", "text": "Juan Pérez llegó..." }`
- **multipart/form-data:** campos `language` y `file` (.txt, máx. 5 MB, UTF-8 o ANSI).

Idiomas: `es`, `en`, `ru` (análisis completo) y `zh`, `ar` (análisis básico).

### 1. Login

```http
POST /api/auth/login
Content-Type: application/json

{ "nickname": "kevin", "password": "MiClave123" }
```

```json
{
  "success": true,
  "tokenType": "Bearer",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 7200,
  "expiresAt": "2026-10-22T02:00:00.000Z",
  "user": { "id": 1, "nickname": "kevin", "fullName": "Kevin ...", "role": "ANALISTA" }
}
```

### 2. Análisis

```http
POST /api/analysis
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{ "language": "es", "text": "Juan Pérez llegó. Él estudia autómatas." }
```

Respuesta (resumida): `totalWords`, `mostRepeated`, `leastRepeated`, `pronouns`, `persons`,
`properNouns`, `nouns` y `verbs` (`{ root, forms, count }`), `adverbs`, `patterns`
(correos, URL, fechas, horas, teléfonos, montos, porcentajes, números, hashtags, menciones, siglas).

### Errores (siempre JSON, sin detalles internos)

| Código HTTP | `error` | Cuándo |
|---|---|---|
| 400 | `credenciales_requeridas`, `idioma_invalido`, `texto_requerido`, `texto_vacio`, `json_invalido`, `solo_txt` | Entrada inválida |
| 401 | `credenciales_invalidas`, `token_requerido`, `token_invalido`, `token_expirado`, `token_revocado`, `usuario_inactivo` | Sin acceso |
| 403 | `cuenta_pendiente`, `cuenta_deshabilitada`, `rol_inactivo`, `sin_permiso` | Sin permiso |
| 413 | `texto_muy_grande` | Más de 5 MB |
| 429 | `demasiados_intentos` | 10 logins fallidos en 15 min (misma IP) |

## Seguridad aplicada (OWASP)
- Firma HS256 con `crypto` (sin librerías externas); se rechaza `alg: none` y cualquier otro algoritmo.
- Comparación de firma en tiempo constante; validación de `exp`, `iss` y `aud`.
- En cada petición se consulta el usuario: si el admin lo desactiva o desactiva su rol/permiso, el token deja de servir.
- Logout revoca el token (`jti`); límite de intentos de login por IP.
- Cada login (web con contraseña, rostro o QR, y API) queda en la **bitácora** `login_audit`: usuario, método, resultado, IP, navegador y fecha (UTC). La web la muestra en *Bitácora de accesos* (solo ADMIN).
- La web usa **reCAPTCHA v2** en login con contraseña y registro (`RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`). La API no lo usa: se protege con el límite de intentos.
- Validación de idioma (lista blanca), tamaño y tipo de archivo; respuestas con `Cache-Control: no-store` y `nosniff`.

## Postman
Importar `docs/postman_collection.json`. La petición **Login** guarda el token en la variable `token`
automáticamente; las demás lo envían como `Bearer {{token}}`. Cambiar `baseUrl` al dominio público al publicar.

## Pruebas
`bun test` ejecuta las pruebas unitarias (autómata, patrones, analizador, JWT) y de caja negra de la API (`tests/`).
