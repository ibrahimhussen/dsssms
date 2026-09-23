import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost', port: 3306,
  user: 'dsssms_user', password: 'mudasir',
  database: 'dsssms_db',
});

const [grants] = await conn.query('SHOW GRANTS FOR CURRENT_USER()');
console.log('Current grants:');
for (const g of grants) console.log(Object.values(g)[0]);

// Check if user can create _prisma_migrations in test db
try {
  await conn.query('USE dsssms_test');
  await conn.query('CREATE TABLE IF NOT EXISTS _prisma_test (id INT)');
  await conn.query('DROP TABLE IF EXISTS _prisma_test');
  console.log('CAN create/drop tables in dsssms_test');
} catch(e) {
  console.log('CANNOT use dsssms_test:', e.message);
}

await conn.end();
