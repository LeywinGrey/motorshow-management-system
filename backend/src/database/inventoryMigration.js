/**
 * Migrasi modul Inventory: memperluas tabel `motorcycles` agar menampung 13 kolom
 * template Excel "STOK UNIT MM.xlsx".
 *
 * Sifat migrasi:
 * - IDEMPOTEN   : aman dijalankan berulang kali (kolom/index yang sudah ada dilewati).
 * - NON-DESTRUKTIF: tidak menghapus kolom/data lama. Baris lama tetap ada
 *   (kolom baru bernilai NULL) sehingga relasi ke booking & pelanggan tidak berubah.
 * - Kompatibel MySQL & TiDB: setiap perubahan = 1 statement ALTER terpisah
 *   (TiDB tidak mendukung banyak perubahan skema dalam satu ALTER).
 *
 * Pemetaan Excel -> kolom database:
 *   Channel          -> channel
 *   No.              -> channel_no        (nomor urut per channel, BUKAN primary key)
 *   Tipe Motor       -> type_code         (contoh: H1B2N2A5)
 *   Nama Tipe Motor  -> model             (kolom lama, dipakai modul Sales/Booking)
 *   Kode Warna       -> color_code
 *   Warna            -> color             (kolom lama)
 *   Tahun            -> year              (kolom lama)
 *   Nomor Mesin      -> engine_number     (UNIQUE)
 *   Nomor Rangka     -> frame_number      (UNIQUE)
 *   Tanggal Beli     -> purchase_date     (DATE)
 *   Tanggal Display  -> display_date      (DATE)
 *   Gesekan          -> gesekan           (boleh kosong)
 *   Supplier         -> supplier
 *
 * Jalankan manual: npm run migrate:inventory
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const NEW_COLUMNS = [
  ['channel',       'VARCHAR(100) NULL'],
  ['channel_no',    'INT NULL'],
  ['type_code',     'VARCHAR(30) NULL'],
  ['color_code',    'VARCHAR(10) NULL'],
  ['engine_number', 'VARCHAR(30) NULL'],
  ['frame_number',  'VARCHAR(30) NULL'],
  ['purchase_date', 'DATE NULL'],
  ['display_date',  'DATE NULL'],
  ['gesekan',       'VARCHAR(100) NULL'],
  ['supplier',      'VARCHAR(100) NULL'],
];

// [nama index, definisi]
const NEW_INDEXES = [
  ['uq_motorcycles_engine_number', 'UNIQUE INDEX uq_motorcycles_engine_number (engine_number)'],
  ['uq_motorcycles_frame_number',  'UNIQUE INDEX uq_motorcycles_frame_number (frame_number)'],
  ['idx_motorcycles_channel',      'INDEX idx_motorcycles_channel (channel, channel_no)'],
  ['idx_motorcycles_supplier',     'INDEX idx_motorcycles_supplier (supplier)'],
  ['idx_motorcycles_type_code',    'INDEX idx_motorcycles_type_code (type_code)'],
  ['idx_motorcycles_year',         'INDEX idx_motorcycles_year (year)'],
];

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, table, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows.length > 0;
}

/**
 * @param {import('mysql2/promise').Connection|import('mysql2/promise').Pool} conn
 * @param {(msg: string) => void} log
 */
async function upgradeInventorySchema(conn, log = console.log) {
  const table = 'motorcycles';
  let changed = 0;

  for (const [name, def] of NEW_COLUMNS) {
    if (!(await columnExists(conn, table, name))) {
      await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
      log(`  + kolom ${table}.${name}`);
      changed += 1;
    }
  }

  // Data Excel tidak memuat harga -> kolom price harus boleh kosong.
  const [priceInfo] = await conn.query(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'price'`,
    [table]
  );
  if (priceInfo[0] && priceInfo[0].IS_NULLABLE === 'NO') {
    await conn.query(`ALTER TABLE ${table} MODIFY COLUMN price DECIMAL(15,2) NULL DEFAULT NULL`);
    log(`  ~ kolom ${table}.price sekarang boleh NULL`);
    changed += 1;
  }

  // Showroom khusus Honda: beri default agar insert tanpa brand tetap valid.
  const [brandInfo] = await conn.query(
    `SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'brand'`,
    [table]
  );
  if (brandInfo[0] && (brandInfo[0].COLUMN_DEFAULT === null || brandInfo[0].COLUMN_DEFAULT === undefined)) {
    await conn.query(`ALTER TABLE ${table} MODIFY COLUMN brand VARCHAR(50) NOT NULL DEFAULT 'Honda'`);
    log(`  ~ kolom ${table}.brand default 'Honda'`);
    changed += 1;
  }

  for (const [name, def] of NEW_INDEXES) {
    if (!(await indexExists(conn, table, name))) {
      await conn.query(`ALTER TABLE ${table} ADD ${def}`);
      log(`  + index ${name}`);
      changed += 1;
    }
  }

  log(changed === 0 ? '  (tabel motorcycles sudah sesuai, tidak ada perubahan)' : `  ${changed} perubahan diterapkan.`);
  return changed;
}

// Dijalankan langsung: node src/database/inventoryMigration.js
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
      console.log(`Migrasi Inventory ke database "${process.env.DB_NAME || 'motorshow_db'}" @ ${process.env.DB_HOST || 'localhost'} ...`);
      await upgradeInventorySchema(conn);
      console.log('✅ Migrasi Inventory selesai.');
    } catch (err) {
      console.error('❌ Migrasi Inventory gagal:', err.message);
      process.exitCode = 1;
    } finally {
      await conn.end();
    }
  })();
}

module.exports = { upgradeInventorySchema };
