/**
 * Import data awal dari file Excel ke database (CLI).
 * Pakai: npm run import:stok -- [path-file.xlsx] [--dry-run]
 * Default file: backend/data/STOK_UNIT_MM.xlsx
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const pool = require('../config/db');
const { importInventory } = require('../services/inventoryImportService');

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'data', 'STOK_UNIT_MM.xlsx'));
  try {
    console.log(`Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST}`);
    console.log(`File    : ${file}${dryRun ? ' (dry-run, tidak menyimpan)' : ''}`);
    const r = await importInventory(pool, fs.readFileSync(file), { dryRun });
    console.log(`Total baris: ${r.total_rows} | valid: ${r.valid} | berhasil diimpor: ${r.imported} | gagal: ${r.failed}`);
    r.errors.slice(0, 50).forEach((e) => console.log(`  baris ${e.row} (${e.engine_number || '-'}): ${e.reasons.join(' ')}`));
  } catch (err) {
    console.error('❌ Import gagal:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
