const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306,
    user: 'dsssms_user', password: 'mudasir',
    database: 'dsssms_db',
  });

  const [ucols] = await conn.query('DESCRIBE users');
  console.log('users columns:', ucols.map(c => c.Field));

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
