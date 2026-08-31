require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function encryptPasswords() {
  console.log('Conectando a la base de datos...');

  const [users] = await pool.query('SELECT id, username, password FROM users');
  console.log(`Encontrados ${users.length} usuarios`);

  for (const user of users) {
    // Verificar si ya está encriptado (bcrypt empieza con $2a$ o $2b$)
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      console.log(`  ${user.username}: ya encriptado, saltando`);
      continue;
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(user.password, salt);

    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
    console.log(`  ${user.username}: "${user.password}" -> hash encriptado`);
  }

  console.log('Listo. Todas las contraseñas encriptadas.');
  await pool.end();
}

encryptPasswords().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
