/**
 * Crea la tabla user_photos (foto modificada del usuario) en la base de datos del .env
 * Ejecutar una sola vez:  bun run src/scripts/create-user-photos.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function main() {
  const archivo = path.join(__dirname, '..', '..', 'sql', 'create_user_photos.sql');
  // Se quitan los comentarios y se ejecuta la sentencia CREATE TABLE
  const sql = fs.readFileSync(archivo, 'utf8')
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n')
    .trim();

  // La llave foránea exige que user_id tenga EXACTAMENTE el mismo tipo que users.id
  // (INT, INT UNSIGNED, BIGINT...). Se lee el tipo real y se usa en la tabla nueva.
  const [id] = await pool.query("SHOW COLUMNS FROM users LIKE 'id'");
  if (!id[0]) throw new Error('No se encontró la columna users.id');
  const tipoId = id[0].Type.toUpperCase();
  console.log(`Tipo de users.id: ${tipoId}`);

  await pool.query(sql.replace(/user_id\s+INT\b/, `user_id ${tipoId}`));
  const [columnas] = await pool.query('SHOW COLUMNS FROM user_photos');
  console.log('Tabla user_photos lista. Columnas:', columnas.map((c) => c.Field).join(', '));

  const [foto] = await pool.query("SHOW COLUMNS FROM users LIKE 'photo'");
  if (foto[0]) console.log(`Tipo de users.photo: ${foto[0].Type}`);
}

main()
  .catch((err) => {
    console.error('No se pudo crear la tabla:', err.code || '', err.sqlMessage || err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
