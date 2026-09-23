import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'localhost', port: 3306,
  user: 'dsssms_user', password: 'mudasir',
  database: 'dsssms_test',
  multipleStatements: true,
});

await conn.query('SET FOREIGN_KEY_CHECKS=0');
const [tables] = await conn.query('SHOW TABLES');
for (const row of tables) {
  const name = Object.values(row)[0];
  await conn.query(`DROP TABLE IF EXISTS \`${name}\``);
  console.log(`Dropped: ${name}`);
}
await conn.query('SET FOREIGN_KEY_CHECKS=1');
const [remaining] = await conn.query('SHOW TABLES');
console.log(`Tables remaining: ${remaining.length}`);
await conn.end();
