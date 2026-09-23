/**
 * dsssms_user has ALL PRIVILEGES on dsssms_db.* — check if WITH GRANT OPTION
 * was included, and if so, self-grant SELECT/INSERT/UPDATE/DELETE on dsssms_test.
 */
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'dsssms_user', password: 'mudasir',
    database: 'dsssms_db',
  });

  // Check if GRANT OPTION is available
  const [grants] = await conn.query('SHOW GRANTS FOR CURRENT_USER()');
  for (const g of grants) {
    const v = Object.values(g)[0];
    console.log(v);
  }

  // Try to self-grant
  try {
    await conn.query("GRANT SELECT, INSERT, UPDATE, DELETE ON `dsssms_test`.* TO 'dsssms_user'@'localhost'");
    console.log('Self-grant succeeded');
  } catch(e) {
    console.log('Self-grant failed:', e.message);
  }

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
