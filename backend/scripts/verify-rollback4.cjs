const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'dsssms_user', password: 'mudasir',
    database: 'dsssms_db',
  });

  const [[{cnt: before}]] = await conn.query('SELECT COUNT(*) as cnt FROM users');

  await conn.query('START TRANSACTION');
  // Insert with correct columns
  await conn.query(
    "INSERT INTO users (username, password, roleId, status, isTemporaryPassword) VALUES ('__test_rollback__', '$2b$12$x', 1, 'ACTIVE', 1)"
  );
  const [[{cnt: during}]] = await conn.query('SELECT COUNT(*) as cnt FROM users');
  await conn.query('ROLLBACK');
  const [[{cnt: after}]] = await conn.query('SELECT COUNT(*) as cnt FROM users');

  console.log(`users: before=${before} during=${during} after=${after}`);
  console.log('Rollback works:', String(before) === String(after) ? 'YES ✓' : 'NO ✗');

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
