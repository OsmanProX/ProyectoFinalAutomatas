# Credencial PDF con QR y notificaciones (Kevin)

## Qué hace
- Al registrarse, el sistema genera la **credencial de inscripción** (PDF de 2 caras, tamaño tarjeta)
  con la **foto modificada**, nombre, @apodo, rol, número `LFA-AAAA-00000` y un **código QR**.
- Se envía **automáticamente** según el método de notificación elegido: correo, WhatsApp o ambos.
  El envío corre en segundo plano para no retrasar el registro (< 30 s).
- Desde el panel, el usuario puede ver/descargar su credencial: enlace **🪪 Mi credencial** (`/perfil/credencial`).
- El QR contiene `LFA1.<id>.<secreto>`. El secreto se guarda **cifrado con AES-256-GCM** en
  `user_credentials.qr_token_enc` y servirá para el **login con QR**.

## Instalación (una sola vez)
```bash
bun install                                   # instala qrcode, pdfkit y nodemailer
bun run src/scripts/create-user-credentials.js
```

## Variables del .env
Agregar al `.env` (NO subir el .env a GitHub):

```env
# Correo (ejemplo con Gmail: usar una "contraseña de aplicación" de Google)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=correo.del.proyecto@gmail.com
SMTP_PASS=contraseña_de_aplicacion_de_16_letras
MAIL_FROM="Proyecto Autómatas <correo.del.proyecto@gmail.com>"

# WhatsApp con Twilio (requiere el sitio publicado con https)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=+14155238886
PUBLIC_BASE_URL=https://dominio-del-proyecto.com
DEFAULT_COUNTRY_CODE=502

# Opcional: llave para cifrar el QR (si no existe se usa SESSION_SECRET).
# Si se cambia, las credenciales anteriores dejan de servir para el login con QR.
CREDENTIAL_SECRET=
```

Si el correo o WhatsApp no están configurados, el registro funciona igual y en la consola
aparece: `Credencial LFA-...: no se envió por correo_electronico (correo_no_configurado)`.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `src/services/credential.service.js` | Genera el token QR, diseña el PDF y lo envía |
| `src/services/messaging.service.js` | Envío por correo (nodemailer) y WhatsApp (Twilio) |
| `src/repositories/credential.repository.js` | Tabla `user_credentials` |
| `src/utils/crypto.js` | Cifrado AES-256-GCM y enlaces firmados (HMAC) |
| `src/routes/credential.routes.js` | `GET /credencial/publica/:token` (enlace temporal para WhatsApp) |
| `sql/create_user_credentials.sql` | Script de la tabla |
