/**
 * Grant full privileges on dsssms_test to dsssms_user.
 * Run this once with MySQL root credentials.
 * Usage: node scripts/grant-test-db.mjs <root-password>
 */
import mysql from 'mysql2/promise';

const rootPass = process.argv[2] ?? '';

const conn = await mysql.createConnection({
  host: 'localhost', port: 3306,
  user: 'root', password: rootPass,
});

try {
  await conn.query("GRANT ALL PRIVILEGES ON `dsssms_test`.* TO 'dsssms_user'@'localhost'");
  await conn.query('FLUSH PRIVILEGES');
  console.log('Grants applied successfully.');
} finally {
  await conn.end();
}
