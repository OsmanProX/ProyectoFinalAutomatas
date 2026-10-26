# Evidencia de pruebas automatizadas

**Proyecto Final · Lenguajes Formales y Autómatas · UMG 2026**
**Fecha de ejecución:** 25/10/2026 · **Herramienta:** `bun test` (Bun v1.4.0) · **Responsable:** Kevin

## Resultado

| Total de pruebas | Correctas | Fallidas | Verificaciones (`expect`) | Archivos | Tiempo |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **94** | **94** ✅ | **0** | 224 | 6 | 0.93 s |

## Qué se probó

| Archivo | Pruebas | Tipo | Qué cubre |
|---|:---:|---|---|
| `tests/lexer.test.js` | 50 | Caja blanca | Autómata finito (escáner): palabras, signos, oraciones, abreviaturas y siglas con puntos (L.A., O.N.U.), dominios (.LA), "casa.El" sin espacio y líneas en blanco como fin de oración; 16 patrones con expresiones regulares (correo, URL, fecha, hora, teléfono, moneda, porcentaje, número, número romano, hashtag, mención, sigla, dominio, palabra con punto en medio, código); analizador en español, inglés, ruso, chino y árabe (pronombres, nombres de personas, sustantivos y verbos por raíz); palabras que menos se repiten completas de la A a la Z; lectura de `.txt` en UTF-8 y ANSI |
| `tests/api.test.js` | 13 | Caja negra | API REST `/api`: login con JWT, errores 400/401/403, análisis por JSON y por archivo `.txt`, generación del PDF, permisos de menú por rol, bitácora solo para ADMIN y logout |
| `tests/web-seguridad.test.js` | 12 | Caja negra | Seguridad web (OWASP): límite de intentos por apodo y por IP, protección CSRF por Origin/Referer, cabeceras de seguridad, páginas de error 404/500 sin información sensible y resumen del Inicio del supervisor |
| `tests/seguridad.test.js` | 8 | Caja blanca | reCAPTCHA v2 y v3 (sin claves, respuesta de Google, puntaje y acción) y bitácora de accesos (IP real, navegador y sistema, filtros con hora de Guatemala) |
| `tests/jwt.test.js` | 6 | Caja blanca | Token JWT HS256: firma y verificación, rechazo de token modificado, de `alg: none`, vencido, revocado (logout) y texto inválido |
| `tests/whatsapp.test.js` | 5 | Caja negra | Registro de envíos de WhatsApp (teléfono enmascarado, estado aceptado o fallido) y webhook de Wawp sin polling (clave secreta, estados entregado y leído, eventos ignorados) |

> Los avisos que aparecen en la consola (`reCAPTCHA desactivado…`, `reCAPTCHA no respondió: sin red`, `Wawp (text) respondió 429 limite`, `[Seguridad] … bloqueado`, `[Seguridad] CSRF: se rechazó…`) son parte de las pruebas: simulan a propósito la falta de claves, la caída de Google, el límite de mensajes de Wawp, un ataque de fuerza bruta y una solicitud desde otro sitio, para comprobar que el sistema responde bien en esos casos. Las pruebas no usan la base de datos real ni envían mensajes reales.

## Prueba de carga: libros grandes

Prueba manual del análisis léxico con el libro *Cien años de soledad* y textos más grandes (límite del sistema: 5 MB).

| Texto | Caracteres | Palabras | Palabras distintas | Tiempo de análisis |
|---|---:|---:|---:|---:|
| Cien años de soledad | 826,863 | 139,087 | 15,680 | 1.3 s (en la página) |
| Texto de 2.42 MB | 2,480,589 | 417,261 | 46,985 | 2.3 s |
| Texto de 4.84 MB | 4,961,183 | 834,522 | 93,700 | 4.8 s (5.6 s subir y ver resultados) |
| Archivo de 5.5 MB | — | — | — | Rechazado: "El archivo supera el límite de 5 MB" |

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
✓ API /api/auth > health es público [9.32ms]
✓ API /api/auth > login correcto devuelve un token Bearer [10.19ms]
✓ API /api/auth > login incorrecto -> 401, cuenta pendiente -> 403, JSON roto -> 400 [3.57ms]
✓ API /api/auth > sin token o con token falso -> 401 [4.28ms]
✓ API /api/auth > /auth/me con token devuelve el usuario [1.01ms]
✓ API /api/analysis > analiza texto en JSON [9.20ms]
✓ API /api/analysis > analiza un archivo .txt (multipart) [10.78ms]
✓ API /api/analysis > valida la entrada [2.91ms]
✓ API /api/analysis > genera el PDF [127.82ms]
✓ API /api/analysis > respeta los permisos de menú del rol [4.25ms]
✓ API /api/analysis > la bitácora registra los logins de la API [0.20ms]
✓ API /api/analysis > GET /audit/logins es solo para ADMIN [0.95ms]
✓ API /api/analysis > logout invalida el token [2.32ms]

tests\jwt.test.js:
✓ JWT > firma y verifica un token [0.16ms]
✓ JWT > rechaza un token modificado [0.51ms]
✓ JWT > rechaza alg "none" [0.21ms]
✓ JWT > rechaza un token vencido [0.44ms]
✓ JWT > logout: un token revocado deja de servir [0.65ms]
✓ JWT > rechaza basura [0.11ms]

tests\lexer.test.js:
✓ Autómata (escáner) > separa palabras por espacios y signos [0.29ms]
✓ Autómata (escáner) > mantiene signos internos dentro del lexema [0.29ms]
✓ Autómata (escáner) > detecta fin de oración y marca la palabra siguiente [0.28ms]
✓ Autómata (escáner) > no corta la oración en abreviaturas conocidas [0.33ms]
✓ Autómata (escáner) > reconoce la puntuación del chino y del árabe [0.18ms]
✓ Patrones (expresiones regulares) > soporte@miumg.edu.gt -> CORREO [0.27ms]
✓ Patrones (expresiones regulares) > https://example.com/a?b=1 -> URL
✓ Patrones (expresiones regulares) > 15/03/2026 -> FECHA
✓ Patrones (expresiones regulares) > 2026-03-15 -> FECHA
✓ Patrones (expresiones regulares) > 08:30 -> HORA
✓ Patrones (expresiones regulares) > 5555-1234 -> TELEFONO [0.02ms]
✓ Patrones (expresiones regulares) > Q1500.00 -> MONEDA
✓ Patrones (expresiones regulares) > 95% -> PORCENTAJE
✓ Patrones (expresiones regulares) > 3.14 -> NUMERO
✓ Patrones (expresiones regulares) > #Autómatas -> HASHTAG [0.02ms]
✓ Patrones (expresiones regulares) > @kevin -> MENCION [0.01ms]
✓ Patrones (expresiones regulares) > UMG -> SIGLA
✓ Patrones (expresiones regulares) > canción -> PALABRA
✓ Patrones (expresiones regulares) > книга -> PALABRA [0.01ms]
✓ Patrones (expresiones regulares) > كتاب -> PALABRA [0.02ms]
✓ Patrones (expresiones regulares) > COVID-19 -> CODIGO [0.19ms]
✓ Analizador - español > cuenta palabras y oraciones [0.06ms]
✓ Analizador - español > reconoce pronombres personales [0.17ms]
✓ Analizador - español > reconoce nombres de personas [0.07ms]
✓ Analizador - español > agrupa verbos por raíz [0.13ms]
✓ Analizador - español > reconoce sustantivos por terminación y contexto [0.28ms]
✓ Analizador - inglés y ruso > inglés: contracciones, pronombres y verbos irregulares [0.70ms]
✓ Analizador - inglés y ruso > ruso: nombres con patronímico y verbos [1.92ms]
✓ Analizador - inglés y ruso > rechaza idiomas no soportados [0.11ms]
✓ Analizador básico - chino y árabe > chino: separa palabras sin espacios y reconoce pronombres, nombres y patrones [9.95ms]
✓ Analizador básico - chino y árabe > árabe: quita diacríticos, reconoce pronombres, nombres y raíces [5.98ms]
✓ Servicio (lexer.service) > devuelve los campos que usan la vista y el PDF [2.25ms]
✓ Servicio (lexer.service) > corrige el error anterior: el ruso ya no queda vacío [0.78ms]
✓ Servicio (lexer.service) > texto vacío e idioma desconocido no fallan [0.49ms]
✓ Lectura del archivo .txt > UTF-8 con BOM [0.10ms]
✓ Lectura del archivo .txt > ANSI (Windows-1252) no pierde tildes [0.09ms]
✓ Lectura del archivo .txt > nombre de archivo sin rutas ni caracteres peligrosos [0.03ms]
✓ Revisión de Osman: libro completo, puntos y guiones > siglas con puntos (L.A., O.N.U., EE.UU.) son un solo lexema con su punto [0.28ms]
✓ Revisión de Osman: libro completo, puntos y guiones > si después de la sigla viene una mayúscula, también termina la oración [0.17ms]
✓ Revisión de Osman: libro completo, puntos y guiones > una sigla con puntos se cuenta como nombre que se repite [1.72ms]
✓ Revisión de Osman: libro completo, puntos y guiones > dominios y extensiones con punto al inicio (.LA, .com, .txt) [1.49ms]
✓ Revisión de Osman: libro completo, puntos y guiones > nombres con guion se cuentan todas las veces, también al inicio de oración [1.18ms]
✓ Revisión de Osman: libro completo, puntos y guiones > palabras que menos se repiten: todas y agrupadas de la A a la Z [4.06ms]
✓ Revisión de Osman: libro completo, puntos y guiones > una palabra común al inicio de oración no se vuelve nombre ("Era", "Cien") [2.49ms]
✓ Revisión de Osman: libro completo, puntos y guiones > el PDF agrupa de la A a la Z aunque el análisis venga de la sesión sin grupos [53.76ms]
✓ Revisión de Osman: libro completo, puntos y guiones > "ho.a" (letras con un punto en medio) cuenta como palabra y sale en su clasificación [1.03ms]
✓ Revisión de Osman: libro completo, puntos y guiones > sin espacio después del punto ("casa.El perro") se separan las oraciones [0.24ms]
✓ Revisión de Osman: libro completo, puntos y guiones > línea en blanco = fin de oración: el encabezado no se une con el párrafo [1.31ms]
✓ Revisión de Osman: libro completo, puntos y guiones > números romanos aparte y palabras en MAYÚSCULAS comunes no son siglas [1.30ms]
✓ Revisión de Osman: libro completo, puntos y guiones > las tildes no crean grupos aparte, la Ñ sí [0.33ms]

tests\seguridad.test.js:
reCAPTCHA desactivado: faltan RECAPTCHA_SITE_KEY y RECAPTCHA_SECRET_KEY en .env
✓ reCAPTCHA > sin claves en .env queda desactivado y no bloquea [4.19ms]
✓ reCAPTCHA > con claves: acepta solo si Google responde success [5.40ms]
reCAPTCHA no respondió: sin red
✓ reCAPTCHA > con claves: sin token o si Google no responde, se rechaza [0.80ms]
✓ reCAPTCHA > versión: 2 por defecto, 3 solo si RECAPTCHA_VERSION=3 [0.38ms]
reCAPTCHA v3 rechazado: puntaje 0.2, acción login
reCAPTCHA v3 rechazado: puntaje 0.9, acción registro
reCAPTCHA v3 rechazado: puntaje undefined, acción login
✓ reCAPTCHA > v3: acepta solo con puntaje suficiente y la acción esperada [1.15ms]
✓ Bitácora de accesos > IP del usuario (IPv4 mapeada y proxy) [3.62ms]
✓ Bitácora de accesos > navegador y sistema desde el user-agent [2.72ms]
✓ Bitácora de accesos > filtros: valida método, resultado y fechas (hora de Guatemala) [0.44ms]

tests\web-seguridad.test.js:
[Seguridad] prueba: bloqueado ::ffff:127.0.0.1 por 60 s
✓ Límite de intentos (fuerza bruta) > después de 3 contraseñas incorrectas bloquea con 429 y mensaje claro [11.68ms]
[Seguridad] prueba: bloqueado 10.0.0.50 por 60 s
[Seguridad] prueba: bloqueado 10.0.0.50 por 60 s
✓ Límite de intentos (fuerza bruta) > por IP permite más intentos (varias personas en la misma red) [12.06ms]
✓ Límite de intentos (fuerza bruta) > un login correcto limpia el contador de esa persona [3.65ms]
✓ Protección CSRF por origen > acepta un POST que viene de este mismo sitio [2.57ms]
[Seguridad] CSRF: se rechazó POST /cambiar desde "https://sitio-malicioso.com"
✓ Protección CSRF por origen > rechaza un POST que viene de otro sitio [2.28ms]
[Seguridad] CSRF: se rechazó POST /cambiar desde "https://otro.com/pagina"
✓ Protección CSRF por origen > si no hay Origin revisa el Referer [3.57ms]
✓ Cabeceras de seguridad > cada respuesta trae nosniff, SAMEORIGIN y frame-ancestors [11.12ms]
✓ Errores sin información sensible > una ruta inexistente muestra la página 404 del sitio [1.84ms]
✓ Errores sin información sensible > un error interno no muestra el mensaje de la base de datos ni rutas de archivos [3.79ms]
✓ Errores sin información sensible > para fetch responde JSON genérico [1.51ms]
✓ Errores sin información sensible > una foto demasiado grande se reporta como 413 [0.14ms]
✓ Inicio del supervisor > resume entregas y accesos de los últimos 7 días [1.89ms]

tests\whatsapp.test.js:
✓ Registro de envíos de WhatsApp > teléfono enmascarado e id del mensaje de Wawp y Green-API [0.23ms]
Wawp (text) respondió 429 limite
✓ Registro de envíos de WhatsApp > un envío correcto queda "aceptado" con su id; uno fallido queda "fallido" [13.25ms]
✓ Webhook de Wawp (message.ack) > sin la clave correcta responde 404 y no actualiza nada [2.95ms]
✓ Webhook de Wawp (message.ack) > actualiza el estado: 2 = entregado, 3 = leído [3.86ms]
✓ Webhook de Wawp (message.ack) > ignora otros eventos (mensajes de chats) y JSON roto [3.66ms]

 94 pass
 0 fail
 224 expect() calls
Ran 94 tests across 6 files. [929.00ms]
PS C:\Users\kfuen\Downloads\Programa\ProyectoFinalAutomatas>
```
