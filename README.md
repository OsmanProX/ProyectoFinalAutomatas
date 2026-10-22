# Proyecto Final — Lenguajes Formales y Autómatas (UMG 2026)

Aplicación web monolítica modular (Bun + Express + EJS + MySQL) para registrar usuarios con foto,
iniciar sesión (contraseña, reconocimiento facial o QR de la credencial) y hacer **análisis léxico**
de archivos `.txt` en 5 idiomas, con reporte PDF por correo o WhatsApp.

| Capa | Tecnología |
|---|---|
| Frontend | EJS, HTML, CSS, JavaScript (regla de color 60-30-10, responsivo) |
| Backend | Bun 1.3 (compatible con Node.js 22), Express 5 |
| Base de datos | MySQL (centralizada) |
| Servicios | Brevo (correo SMTP), Wawp / Green-API (WhatsApp), Google reCAPTCHA v2, API de reconocimiento facial |
| Seguridad | bcrypt, JWT HS256, reCAPTCHA, bitácora de accesos, consultas parametrizadas, `.env` |

---

## 1. Requisitos
- [Git](https://git-scm.com/) y [GitHub Desktop](https://desktop.github.com/) (opcional)
- [Bun 1.3](https://bun.sh/) — Windows (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`
- Acceso a la base de datos MySQL del proyecto (datos en `.env`)
- Opcional: [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## 2. Clonar el repositorio
```bash
git clone https://github.com/<organizacion>/ProyectoFinalAutomatas.git
cd ProyectoFinalAutomatas
git checkout rama_Combinada
```
Ramas: `rama_Combinada` (integración del equipo), una rama por integrante (`rama_Kevin`, `rama_Osman`, …) y `main` (entrega final).

## 3. Variables de entorno
```bash
copy .env.example .env      # Windows   (Linux/macOS: cp .env.example .env)
```
Llenar los valores (se piden al equipo por privado). **El `.env` nunca se sube a GitHub.**

| Variable | Para qué sirve |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` | Conexión MySQL (si la contraseña empieza con `#`, ponerla entre comillas) |
| `PORT`, `SESSION_SECRET` | Puerto del servidor y clave de la sesión |
| `SMTP_*`, `MAIL_FROM` | Correo con Brevo (`SMTP_HOST=smtp-relay.sendinblue.com`, puerto 587) |
| `WAWP_INSTANCE_ID`, `WAWP_ACCESS_TOKEN`, `WHATSAPP_TEXTO_APARTE` | WhatsApp con Wawp (prioridad) |
| `GREEN_API_*` | WhatsApp con Green-API (respaldo) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Tokens de la API `/api` |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | reCAPTCHA v2 en login y registro (si faltan, se desactiva) |
| `TRUST_PROXY` | `true` en el hosting para guardar la IP real en la bitácora |
| `FACE_API_BASE` | Servicio de reconocimiento facial |

## 4. Compilar y ejecutar (backend + frontend)
El frontend (vistas EJS, CSS y JS en `assets/`) lo sirve el mismo backend: se compilan y ejecutan juntos.
```bash
bun install          # instala las dependencias
bun run dev          # desarrollo (se reinicia al guardar)
bun run start        # producción
```
Abrir **http://localhost:3000**. Al iniciar, la consola debe mostrar `Servidor corriendo en http://localhost:3000`.

Base de datos: las tablas base están en `sql/` (script completo exportado desde MySQL Workbench).
Las tablas `role_menu_permissions` y `login_audit` se crean solas al iniciar o al primer uso.

## 5. Pruebas
```bash
bun test
```
62 pruebas: autómata (AFD), patrones (regex), analizador léxico (es/en/ru/zh/ar), JWT, reCAPTCHA,
bitácora y API (caja negra con repositorios simulados). Textos de ejemplo en `ejemplos/`.

## 6. Docker
```bash
docker compose up -d --build     # construye la imagen e inicia en http://localhost:3000
docker compose logs -f app       # ver la consola
docker compose down              # detener
```
- La imagen usa `oven/bun:1.3-slim`, instala las dependencias dentro (no copia `node_modules`)
  e incluye la fuente china para el PDF.
- El `.env` no se copia a la imagen: `docker-compose.yml` lo pasa al ejecutar (`env_file`).
- Sin Compose: `docker build -t automatas .` y `docker run --env-file .env -p 3000:3000 automatas`.

## 7. API REST (JWT)
Guía completa en [`docs/api-jwt.md`](docs/api-jwt.md) y colección Postman en `docs/postman_collection.json`.
```http
POST /api/auth/login        { "nickname": "...", "password": "..." }   -> token
POST /api/analysis          Authorization: Bearer <token>   { "language": "es", "text": "..." }
```

## 8. Estructura
```
src/
  app.js            servidor Express y rutas
  config/           conexión MySQL y constantes
  controllers/      lógica de cada pantalla (auth, perfil, roles, bitácora…)
  dto/              validación de datos de entrada
  lexer/            analizador léxico: automata.js (AFD), patrones.js, analizador.js, basico.js, idiomas/
  middlewares/      sesión, roles y JWT
  models/           modelo User
  repositories/     consultas SQL parametrizadas
  routes/           rutas web y API (/api)
  services/         correo, WhatsApp, PDF, JWT, reCAPTCHA, bitácora, credencial QR…
  views/            vistas EJS
assets/             CSS, JS del navegador, fuentes y modelos
docs/  sql/  tests/  ejemplos/
```

## 9. Problemas comunes
| Síntoma | Solución |
|---|---|
| `Cannot find package 'pdfkit'` (u otro) | `bun install --force` |
| `Access denied ... using password: NO` | La contraseña empieza con `#`: ponerla entre comillas en `.env` |
| `Host: smtp-relay.brevo.com. is not in the cert's altnames` | Usar `SMTP_HOST=smtp-relay.sendinblue.com` |
| WhatsApp: "límite mensual" | Se acabó el cupo gratis del mes; el correo sigue funcionando |
| Cambié el `.env` y no se aplica | Detener con Ctrl+C y volver a ejecutar `bun run dev` |
