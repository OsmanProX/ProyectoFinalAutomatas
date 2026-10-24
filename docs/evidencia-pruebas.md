# Evidencia de pruebas automatizadas

**Proyecto Final · Lenguajes Formales y Autómatas · UMG 2026**
**Fecha de ejecución:** 23/10/2026 · **Herramienta:** `bun test` (Bun v1.4.0) · **Responsable:** Kevin

## Resultado

| Total de pruebas | Correctas | Fallidas | Verificaciones (`expect`) | Archivos | Tiempo |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **67** | **67** ✅ | **0** | 135 | 5 | 1.46 s |

## Qué se probó

| Archivo | Pruebas | Qué cubre |
|---|:---:|---|
| `tests/lexer.test.js` | 37 | Autómata finito (escáner): separación de palabras, signos y oraciones; 16 patrones con expresiones regulares (correo, URL, fecha, hora, teléfono, moneda, porcentaje, número, hashtag, mención, sigla, código); analizador en español, inglés, ruso, chino y árabe (pronombres, nombres de personas, sustantivos y verbos por raíz); lectura de `.txt` en UTF-8 y ANSI |
| `tests/api.test.js` | 13 | API REST `/api`: login con JWT, errores 400/401/403, análisis por JSON y por archivo `.txt`, generación del PDF, permisos de menú por rol, bitácora solo para ADMIN y logout |
| `tests/jwt.test.js` | 6 | Token JWT HS256: firma y verificación, rechazo de token modificado, de `alg: none`, vencido, revocado (logout) y texto inválido |
| `tests/seguridad.test.js` | 6 | reCAPTCHA v2 (sin claves, respuesta correcta, sin token o sin respuesta de Google) y bitácora de accesos (IP real, navegador y sistema, filtros con hora de Guatemala) |
| `tests/whatsapp.test.js` | 5 | Registro de envíos de WhatsApp (teléfono enmascarado, estado aceptado o fallido) y webhook de Wawp sin polling (clave secreta, estados entregado y leído, eventos ignorados) |

> Los avisos que aparecen en la consola (`reCAPTCHA desactivado…`, `reCAPTCHA no respondió: sin red`, `Wawp (text) respondió 429 limite`) son parte de las pruebas: simulan a propósito la falta de claves, la caída de Google y el límite de mensajes de Wawp, para comprobar que el sistema responde bien en esos casos. Las pruebas no usan la base de datos real ni envían mensajes reales.

## Cómo repetir la prueba

```bash
bun install
bun test
```

## Salida completa de la consola

```text
PS C:\Users\kfuen\Downloads\Programa\ProyectoFinalAutomatas> bun test
bun test v1.4.0 (34cbb9a40)

tests\api.test.js:
✓ API /api/auth > health es público [17.91ms]
✓ API /api/auth > login correcto devuelve un token Bearer [20.21ms]
✓ API /api/auth > login incorrecto -> 401, cuenta pendiente -> 403, JSON roto -> 400 [7.74ms]
✓ API /api/auth > sin token o con token falso -> 401 [4.06ms]
✓ API /api/auth > /auth/me con token devuelve el usuario [2.25ms]
✓ API /api/analysis > analiza texto en JSON [53.62ms]
✓ API /api/analysis > analiza un archivo .txt (multipart) [57.44ms]
✓ API /api/analysis > valida la entrada [3.31ms]
✓ API /api/analysis > genera el PDF [206.14ms]
✓ API /api/analysis > respeta los permisos de menú del rol [37.58ms]
✓ API /api/analysis > la bitácora registra los logins de la API [0.30ms]
✓ API /api/analysis > GET /audit/logins es solo para ADMIN [2.32ms]
✓ API /api/analysis > logout invalida el token [3.86ms]

tests\jwt.test.js:
✓ JWT > firma y verifica un token [0.43ms]
✓ JWT > rechaza un token modificado [0.46ms]
✓ JWT > rechaza alg "none" [0.16ms]
✓ JWT > rechaza un token vencido [0.34ms]
✓ JWT > logout: un token revocado deja de servir [0.24ms]
✓ JWT > rechaza basura [0.12ms]

tests\lexer.test.js:
✓ Autómata (escáner) > separa palabras por espacios y signos [4.77ms]
✓ Autómata (escáner) > mantiene signos internos dentro del lexema [5.22ms]
✓ Autómata (escáner) > detecta fin de oración y marca la palabra siguiente [0.44ms]
✓ Autómata (escáner) > no corta la oración en abreviaturas conocidas [0.45ms]
✓ Autómata (escáner) > reconoce la puntuación del chino y del árabe [1.44ms]
✓ Patrones (expresiones regulares) > soporte@miumg.edu.gt -> CORREO [0.19ms]
✓ Patrones (expresiones regulares) > https://example.com/a?b=1 -> URL [0.04ms]
✓ Patrones (expresiones regulares) > 15/03/2026 -> FECHA [0.01ms]
✓ Patrones (expresiones regulares) > 2026-03-15 -> FECHA
✓ Patrones (expresiones regulares) > 08:30 -> HORA
✓ Patrones (expresiones regulares) > 5555-1234 -> TELEFONO
✓ Patrones (expresiones regulares) > Q1500.00 -> MONEDA
✓ Patrones (expresiones regulares) > 95% -> PORCENTAJE
✓ Patrones (expresiones regulares) > 3.14 -> NUMERO
✓ Patrones (expresiones regulares) > #Autómatas -> HASHTAG
✓ Patrones (expresiones regulares) > @kevin -> MENCION
✓ Patrones (expresiones regulares) > UMG -> SIGLA
✓ Patrones (expresiones regulares) > canción -> PALABRA
✓ Patrones (expresiones regulares) > книга -> PALABRA [0.03ms]
✓ Patrones (expresiones regulares) > كتاب -> PALABRA [0.02ms]
✓ Patrones (expresiones regulares) > COVID-19 -> CODIGO [0.22ms]
✓ Analizador - español > cuenta palabras y oraciones [0.26ms]
✓ Analizador - español > reconoce pronombres personales [1.21ms]
✓ Analizador - español > reconoce nombres de personas [0.17ms]
✓ Analizador - español > agrupa verbos por raíz [0.16ms]
✓ Analizador - español > reconoce sustantivos por terminación y contexto [1.40ms]
✓ Analizador - inglés y ruso > inglés: contracciones, pronombres y verbos irregulares [2.55ms]
✓ Analizador - inglés y ruso > ruso: nombres con patronímico y verbos [2.62ms]
✓ Analizador - inglés y ruso > rechaza idiomas no soportados [0.14ms]
✓ Analizador básico - chino y árabe > chino: separa palabras sin espacios y reconoce pronombres, nombres y patrones [12.81ms]
✓ Analizador básico - chino y árabe > árabe: quita diacríticos, reconoce pronombres, nombres y raíces [12.88ms]
✓ Servicio (lexer.service) > devuelve los campos que usan la vista y el PDF [2.21ms]
✓ Servicio (lexer.service) > corrige el error anterior: el ruso ya no queda vacío [1.34ms]
✓ Servicio (lexer.service) > texto vacío e idioma desconocido no fallan [0.50ms]
✓ Lectura del archivo .txt > UTF-8 con BOM [0.33ms]
✓ Lectura del archivo .txt > ANSI (Windows-1252) no pierde tildes [0.72ms]
✓ Lectura del archivo .txt > nombre de archivo sin rutas ni caracteres peligrosos [0.09ms]

tests\seguridad.test.js:
reCAPTCHA desactivado: faltan RECAPTCHA_SITE_KEY y RECAPTCHA_SECRET_KEY en .env
✓ reCAPTCHA > sin claves en .env queda desactivado y no bloquea [1.11ms]
✓ reCAPTCHA > con claves: acepta solo si Google responde success [0.95ms]
reCAPTCHA no respondió: sin red
✓ reCAPTCHA > con claves: sin token o si Google no responde, se rechaza [0.61ms]
✓ Bitácora de accesos > IP del usuario (IPv4 mapeada y proxy) [0.29ms]
✓ Bitácora de accesos > navegador y sistema desde el user-agent [0.78ms]
✓ Bitácora de accesos > filtros: valida método, resultado y fechas (hora de Guatemala) [0.75ms]

tests\whatsapp.test.js:
✓ Registro de envíos de WhatsApp > teléfono enmascarado e id del mensaje de Wawp y Green-API [0.45ms]
Wawp (text) respondió 429 limite
✓ Registro de envíos de WhatsApp > un envío correcto queda "aceptado" con su id; uno fallido queda "fallido" [15.07ms]
✓ Webhook de Wawp (message.ack) > sin la clave correcta responde 404 y no actualiza nada [8.21ms]
✓ Webhook de Wawp (message.ack) > actualiza el estado: 2 = entregado, 3 = leído [7.06ms]
✓ Webhook de Wawp (message.ack) > ignora otros eventos (mensajes de chats) y JSON roto [4.31ms]

 67 pass
 0 fail
 135 expect() calls
Ran 67 tests across 5 files. [1457.00ms]
PS C:\Users\kfuen\Downloads\Programa\ProyectoFinalAutomatas> ```
