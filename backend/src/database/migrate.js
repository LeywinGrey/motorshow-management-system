/**
 * Migration runner sederhana: membaca schema.sql lalu menjalankannya ke MySQL.
 * Jalankan dengan: npm run migrate
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { upgradeInventorySchema } = require('./inventoryMigration');
require('dotenv').config();

async function migrate() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    console.log('Menjalankan migration...');
    await connection.query(sql);

    // Upgrade tabel motorcycles lama ke struktur Inventory (13 kolom Excel). Aman dijalankan berulang.
    console.log('Memeriksa struktur tabel motorcycles (Inventory)...');
    await upgradeInventorySchema(connection);

    console.log('✅ Migration berhasil. Database & tabel sudah siap.');
  } catch (err) {
    console.error('❌ Migration gagal:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
