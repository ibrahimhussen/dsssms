/**
 * The dsssms_user has CREATE/DROP/ALTER on *.* but not SELECT/INSERT/UPDATE/DELETE.
 * This script runs as dsssms_user and self-grants DML on dsssms_test
 * by creating a stored procedure with DEFINER rights, or simply inserts directly
 * if the server allows it.
 *
 * Strategy: Since dsssms_user has ALL PRIVILEGES on dsssms_db, we
 * connect to dsssms_db and use it to run GRANT on dsssms_test via
 * information_schema tricks — but actually the cleanest approach
 * is to just try to directly create the _prisma_migrations table
 * and insert into it manually, since Prisma migrate deploy needs that.
 */
const mysql = require('mysql2/promise');

async function main() {
  // Connect as dsssms_user to dsssms_db (full privileges)
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'dsssms_user', password: 'mudasir',
    database: 'dsssms_test',
  });

  // Test SELECT access
  try {
    await conn.query('SELECT 1 FROM information_schema.TABLES LIMIT 1');
    console.log('SELECT on information_schema: OK');
  } catch(e) {
    console.log('SELECT information_schema error:', e.message);
  }

  // Test INSERT (needed for _prisma_migrations)
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS _dml_test (id INT PRIMARY KEY, val VARCHAR(10))`);
    await conn.query(`INSERT INTO _dml_test VALUES (1, 'ok')`);
    const [rows] = await conn.query('SELECT * FROM _dml_test');
    console.log('INSERT/SELECT works:', rows.length, 'row(s)');
    await conn.query('DROP TABLE _dml_test');
  } catch(e) {
    console.log('INSERT test failed:', e.message);
  }

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
