/**
 * Verify that dsssms_db supports transactions and rollback.
 * Also count current rows so we confirm nothing changes.
 */
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'dsssms_user', password: 'mudasir',
    database: 'dsssms_db',
  });

  // Check engine of a few tables
  const [engines] = await conn.query(`
    SELECT table_name, engine
    FROM information_schema.tables
    WHERE table_schema = 'dsssms_db'
    LIMIT 5
  `);
  console.log('Table engines:');
  for (const r of engines) console.log(' ', r.TABLE_NAME || r.table_name, r.ENGINE || r.engine);

  // Verify rollback works
  const [[{cnt: before}]] = await conn.query('SELECT COUNT(*) as cnt FROM roles');
  console.log('Roles before:', before);

  await conn.query('START TRANSACTION');
  await conn.query(`INSERT INTO roles (role_name) VALUES ('TEST_ROLE_${Date.now()}')`);
  const [[{cnt: during}]] = await conn.query('SELECT COUNT(*) as cnt FROM roles');
  console.log('Roles during tx:', during);
  await conn.query('ROLLBACK');

  const [[{cnt: after}]] = await conn.query('SELECT COUNT(*) as cnt FROM roles');
  console.log('Roles after rollback:', after);
  console.log('Rollback clean:', String(before) === String(after) ? 'YES' : 'NO');

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
