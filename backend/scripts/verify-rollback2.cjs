const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'dsssms_user', password: 'mudasir',
    database: 'dsssms_db',
  });

  // Check roles columns
  const [cols] = await conn.query('DESCRIBE roles');
  console.log('roles columns:', cols.map(c => c.Field));

  // Check system_settings columns
  const [scols] = await conn.query('DESCRIBE system_settings');
  console.log('system_settings columns:', scols.map(c => c.Field));

  // Count key tables
  const tables = ['users','students','classrooms','roles','system_settings','student_id_counters'];
  for (const t of tables) {
    const [[{cnt}]] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    console.log(`${t}: ${cnt} rows`);
  }

  // Verify rollback with correct column
  const [[{cnt: before}]] = await conn.query('SELECT COUNT(*) as cnt FROM users');
  await conn.query('START TRANSACTION');
  await conn.query(`INSERT INTO users (username, password_hash, role_id, status) VALUES ('__test_rollback__', 'x', 1, 'ACTIVE')`);
  const [[{cnt: during}]] = await conn.query('SELECT COUNT(*) as cnt FROM users');
  await conn.query('ROLLBACK');
  const [[{cnt: after}]] = await conn.query('SELECT COUNT(*) as cnt FROM users');

  console.log(`users: before=${before} during=${during} after=${after}`);
  console.log('Rollback works:', String(before) === String(after) ? 'YES ✓' : 'NO ✗');

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
