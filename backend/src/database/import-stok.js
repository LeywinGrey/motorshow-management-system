/**
 * Import data awal stok unit dari Excel "STOK UNIT MM.xlsx" (473 unit) ke tabel motorcycles.
 *
 * Sumber: src/database/data/stok-unit-mm.json (hasil konversi 1:1 dari file Excel, nilai tidak diubah).
 * Pakai aturan validasi & pencegahan duplikat yang sama dengan fitur Import Excel di aplikasi.
 * Aman dijalankan ulang: unit yang Nomor Mesin/Rangka-nya sudah ada akan dilewati dan dilaporkan.
 *
 * Jalankan:  npm run import:stok            (import sungguhan)
 *            npm run import:stok -- --dry   (hanya validasi, tidak menyimpan)
 *            npm run import:stok -- path/ke/file.json
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const pool = require('../config/db');
const { importRows } = require('../services/inventoryImport');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const fileArg = args.find((a) => !a.startsWith('--'));
  const file = fileArg ? path.resolve(fileArg) : path.join(__dirname, 'data', 'stok-unit-mm.json');

  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Membaca ${rows.length} baris dari ${file}${dryRun ? ' (dry run)' : ''}...`);

  const result = await importRows(pool, rows, { dryRun });
  console.log(`Total baris : ${result.total}`);
  console.log(`Valid       : ${result.valid}`);
  console.log(`Tersimpan   : ${result.inserted}`);
  console.log(`Gagal/dilewati: ${result.failed.length}`);
  result.failed.slice(0, 50).forEach((f) => console.log(`  - baris ${f.row} (${f.engine_number}): ${f.reasons.join('; ')}`));
  if (result.failed.length > 50) console.log(`  ... dan ${result.failed.length - 50} lainnya`);
}

main()
  .catch((err) => { console.error('❌ Import gagal:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
