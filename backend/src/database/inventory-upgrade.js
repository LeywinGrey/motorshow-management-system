/**
 * Upgrade tabel `motorcycles` untuk modul Inventory (template STOK UNIT MM.xlsx).
 *
 * - Idempoten: aman dijalankan berkali-kali, hanya menambah yang belum ada.
 * - TIDAK menghapus kolom / data apa pun. Relasi (bookings, customers) tidak disentuh.
 * - Dipanggil otomatis oleh `npm run migrate`, atau manual: `npm run migrate:inventory`
 *   (untuk database yang sudah berisi data dan dibuat dengan schema lama).
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const NEW_COLUMNS = [
  ['channel', 'VARCHAR(100) DEFAULT NULL'],
  ['channel_no', 'INT DEFAULT NULL'],
  ['type_code', 'VARCHAR(30) DEFAULT NULL'],
  ['color_code', 'VARCHAR(20) DEFAULT NULL'],
  ['engine_number', 'VARCHAR(40) DEFAULT NULL'],
  ['chassis_number', 'VARCHAR(40) DEFAULT NULL'],
  ['purchase_date', 'DATE DEFAULT NULL'],
  ['display_date', 'DATE DEFAULT NULL'],
  ['friction', 'VARCHAR(100) DEFAULT NULL'],
  ['supplier', 'VARCHAR(100) DEFAULT NULL'],
];

const NEW_INDEXES = [
  ['uq_motorcycles_engine', 'UNIQUE KEY uq_motorcycles_engine (engine_number)'],
  ['uq_motorcycles_chassis', 'UNIQUE KEY uq_motorcycles_chassis (chassis_number)'],
  ['idx_motorcycles_channel', 'INDEX idx_motorcycles_channel (channel, channel_no)'],
  ['idx_motorcycles_type_code', 'INDEX idx_motorcycles_type_code (type_code)'],
  ['idx_motorcycles_supplier', 'INDEX idx_motorcycles_supplier (supplier)'],
];

/** conn: koneksi mysql2/promise yang sudah memakai database motorshow_db. */
async function upgradeInventory(conn, log = console.log) {
  const [[{ db }]] = await conn.query('SELECT DATABASE() AS db');

  const [colRows] = await conn.query(
    'SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [db, 'motorcycles']
  );
  const existing = new Map(colRows.map((c) => [c.COLUMN_NAME, c.IS_NULLABLE]));
  if (existing.size === 0) throw new Error('Tabel motorcycles belum ada. Jalankan schema.sql terlebih dahulu.');

  for (const [name, def] of NEW_COLUMNS) {
    if (existing.has(name)) continue;
    await conn.query(`ALTER TABLE motorcycles ADD COLUMN ${name} ${def}`);
    log(`  + kolom ${name}`);
  }

  // Excel stok tidak memuat harga -> price harus boleh NULL
  if (existing.get('price') === 'NO') {
    await conn.query('ALTER TABLE motorcycles MODIFY price DECIMAL(15,2) NULL DEFAULT NULL');
    log('  ~ kolom price sekarang boleh NULL');
  }

  const [idxRows] = await conn.query(
    'SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [db, 'motorcycles']
  );
  const existingIdx = new Set(idxRows.map((i) => i.INDEX_NAME));
  for (const [name, def] of NEW_INDEXES) {
    if (existingIdx.has(name)) continue;
    await conn.query(`ALTER TABLE motorcycles ADD ${def}`);
    log(`  + index ${name}`);
  }
}

module.exports = { upgradeInventory };

// Dijalankan langsung: node src/database/inventory-upgrade.js
if (require.main === module) {
  (async () => {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'motorshow_db',
      ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    });
    try {
      console.log('Upgrade tabel motorcycles untuk Inventory...');
      await upgradeInventory(conn);
      console.log('✅ Upgrade Inventory selesai.');
    } catch (err) {
      console.error('❌ Upgrade Inventory gagal:', err.message);
      process.exit(1);
    } finally {
      await conn.end();
    }
  })();
}
