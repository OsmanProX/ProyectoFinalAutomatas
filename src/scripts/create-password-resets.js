/**
 * Crea la tabla password_resets (códigos para reiniciar la contraseña) en la base de datos del .env
 * Ejecutar una sola vez:  bun run src/scripts/create-password-resets.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function main() {
  const archivo = path.join(__dirname, '..', '..', 'sql', 'create_password_resets.sql');
  const sql = fs.readFileSync(archivo, 'utf8')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n')
    .trim();

  // La llave foránea exige el mismo tipo que users.id (INT, INT UNSIGNED, ...)
  const [id] = await pool.query("SHOW COLUMNS FROM users LIKE 'id'");
  if (!id[0]) throw new Error('No se encontró la columna users.id');
  const tipoId = id[0].Type.toUpperCase();
  console.log(`Tipo de users.id: ${tipoId}`);

  await pool.query(sql.replace(/user_id\s+INT\b/, `user_id ${tipoId}`));
  const [columnas] = await pool.query('SHOW COLUMNS FROM password_resets');
  console.log('Tabla password_resets lista. Columnas:', columnas.map((c) => c.Field).join(', '));
}

main()
  .catch((err) => {
    console.error('No se pudo crear la tabla:', err.code || '', err.sqlMessage || err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
