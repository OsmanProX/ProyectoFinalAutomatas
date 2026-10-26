/**
 * Exporta la estructura REAL de la base de datos (tablas, columnas, llaves) y las
 * IP de los servidores que usa el sistema, para los diagramas de la entrega:
 *   - docs/diccionario-datos.md        diccionario de datos (para el diagrama ER)
 *   - docs/diagramas/esquema.json       datos crudos para generar los diagramas
 * No exporta datos de usuarios ni contraseñas: solo la estructura.
 * Ejecutar:  bun run src/scripts/exportar-esquema.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const pool = require('../config/db');

const TABLAS = ['users', 'roles', 'role_menu_permissions', 'user_credentials', 'user_photos', 'password_resets', 'login_audit'];

/** Servidores externos del sistema: [nombre, host, puerto, protocolo] */
const SERVIDORES = [
  ['Base de datos MySQL', process.env.DB_HOST, 3306, 'MySQL'],
  ['Correo (Brevo SMTP)', process.env.SMTP_HOST || 'smtp-relay.sendinblue.com', Number(process.env.SMTP_PORT || 587), 'SMTP + STARTTLS'],
  ['WhatsApp (Wawp)', 'api.wawp.net', 443, 'HTTPS'],
  ['WhatsApp (Green-API)', (process.env.GREEN_API_URL || 'https://api.green-api.com').replace(/^https?:\/\//, '').replace(/\/.*$/, ''), 443, 'HTTPS'],
  ['Google reCAPTCHA', 'www.google.com', 443, 'HTTPS'],
  ['Reconocimiento facial (ngrok)', (process.env.FACE_API_BASE || 'https://reversal-sedate-catnip.ngrok-free.dev').replace(/^https?:\/\//, '').replace(/\/.*$/, ''), 443, 'HTTPS'],
  ['Dominio del sitio', 'codemac.site', 443, 'HTTPS']
];

async function resolver(host) {
  if (!host) return null;
  try {
    const ips = await dns.resolve4(host);
    return ips.slice(0, 3);
  } catch (err) {
    return null;
  }
}

async function main() {
  const [columnas] = await pool.query(
    `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, COLUMN_TYPE AS tipo, IS_NULLABLE AS nulo,
            COLUMN_KEY AS llave, COLUMN_DEFAULT AS defecto, EXTRA AS extra
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [TABLAS]
  );
  const [foraneas] = await pool.query(
    `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, REFERENCED_TABLE_NAME AS tablaRef,
            REFERENCED_COLUMN_NAME AS columnaRef, CONSTRAINT_NAME AS nombre
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  const [unicos] = await pool.query(
    `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, INDEX_NAME AS indice
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY' AND TABLE_NAME IN (?)`,
    [TABLAS]
  );
  const [todas] = await pool.query(
    'SELECT TABLE_NAME AS tabla FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME'
  );
  const [[version]] = await pool.query('SELECT VERSION() AS version');

  const servidores = [];
  for (const [nombre, host, puerto, protocolo] of SERVIDORES) {
    servidores.push({ nombre, host, puerto, protocolo, ips: await resolver(host) });
  }

  const datos = {
    generado: new Date().toISOString(),
    mysql: version.version,
    tablasDelProyecto: TABLAS,
    otrasTablas: todas.map((t) => t.tabla).filter((t) => !TABLAS.includes(t)),
    columnas,
    foraneas,
    unicos,
    servidores
  };

  const carpeta = path.join(__dirname, '..', '..', 'docs', 'diagramas');
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, 'esquema.json'), JSON.stringify(datos, null, 2));

  // Diccionario de datos en Markdown
  const md = ['# Diccionario de datos', '', `MySQL ${version.version}. Generado con \`bun run src/scripts/exportar-esquema.js\`.`, ''];
  for (const tabla of TABLAS) {
    const cols = columnas.filter((c) => c.tabla === tabla);
    if (!cols.length) continue;
    md.push(`## ${tabla}`, '', '| Columna | Tipo | Nulo | Llave | Por defecto | Extra |', '|---|---|---|---|---|---|');
    cols.forEach((c) => {
      const fk = foraneas.find((f) => f.tabla === tabla && f.columna === c.columna);
      const llave = [c.llave === 'PRI' ? 'PK' : '', fk ? `FK → ${fk.tablaRef}.${fk.columnaRef}` : '', c.llave === 'UNI' ? 'UNIQUE' : '']
        .filter(Boolean).join(', ');
      md.push(`| ${c.columna} | ${c.tipo} | ${c.nulo === 'YES' ? 'Sí' : 'No'} | ${llave} | ${c.defecto === null ? '' : c.defecto} | ${c.extra || ''} |`);
    });
    md.push('');
  }
  fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'diccionario-datos.md'), md.join('\n'));

  console.log(`Listo: ${columnas.length} columnas de ${new Set(columnas.map((c) => c.tabla)).size} tablas, ${foraneas.length} llaves foráneas.`);
  servidores.forEach((s) => console.log(`  ${s.nombre}: ${s.host}:${s.puerto} -> ${s.ips ? s.ips.join(', ') : 'sin respuesta DNS'}`));
  await pool.end();
}

main().catch(async (err) => {
  console.error('No se pudo exportar el esquema:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
