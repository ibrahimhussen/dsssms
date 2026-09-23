const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'dsssms_user', password: 'mudasir',
    database: 'dsssms_db',
  });

  const [grants] = await conn.query('SHOW GRANTS FOR CURRENT_USER()');
  console.log('Current grants:');
  for (const g of grants) console.log(Object.values(g)[0]);

  try {
    await conn.query('USE dsssms_test');
    await conn.query('CREATE TABLE IF NOT EXISTS _prisma_check (id INT PRIMARY KEY)');
    await conn.query('DROP TABLE IF EXISTS _prisma_check');
    console.log('HAS full access to dsssms_test');
  } catch(e) {
    console.log('NO full access to dsssms_test:', e.message);
  }

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
