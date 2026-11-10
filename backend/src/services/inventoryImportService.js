/**
 * Import Excel Inventory (format STOK UNIT MM.xlsx): parse -> validasi -> cek duplikat -> simpan.
 * Dipakai oleh endpoint POST /api/motorcycles/import dan CLI `npm run import:stok`.
 */
const { parseInventoryWorkbook } = require('../utils/inventoryExcel');
const { validateMotorPayload, LABELS } = require('../utils/motorInventory');

const CHUNK = 100;
const MAX_ROWS = 5000;
const MAX_ERRORS_RETURNED = 1000;

const INSERT_COLS = [
  'brand', 'channel', 'channel_no', 'type_code', 'model', 'color_code', 'color', 'year',
  'engine_number', 'frame_number', 'purchase_date', 'display_date', 'gesekan', 'supplier', 'price', 'status',
];
const toValues = (d) => INSERT_COLS.map((c) => {
  if (c === 'brand') return 'Honda';
  if (c === 'status') return 'Tersedia';
  if (c === 'price') return null;
  return d[c] === undefined ? null : d[c];
});

const key = (s) => String(s).trim().toLowerCase(); // collation DB case-insensitive -> samakan perilaku

async function findExisting(pool, field, values) {
  const found = new Set();
  for (let i = 0; i < values.length; i += 500) {
    const part = values.slice(i, i + 500);
    const [rows] = await pool.query(`SELECT ${field} AS v FROM motorcycles WHERE ${field} IN (?)`, [part]);
    rows.forEach((r) => found.add(key(r.v)));
  }
  return found;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {Buffer} buffer
 * @param {{dryRun?: boolean}} opts
 */
async function importInventory(pool, buffer, { dryRun = false } = {}) {
  const { rows, sheetName } = await parseInventoryWorkbook(buffer);
  if (rows.length === 0) throw new Error('File tidak berisi data unit motor.');
  if (rows.length > MAX_ROWS) throw new Error(`Maksimal ${MAX_ROWS} baris per import (file berisi ${rows.length}).`);

  const failed = []; // { row, engine_number, frame_number, channel, reasons[] }
  const candidates = [];

  // 1) validasi tiap baris
  for (const { rowNumber, raw } of rows) {
    const { data, errors } = validateMotorPayload(raw, { partial: false });
    if (errors.length) {
      failed.push({ row: rowNumber, channel: raw.channel ?? null, engine_number: raw.engine_number ?? null, frame_number: raw.frame_number ?? null, reasons: errors.map((e) => e.message) });
    } else {
      candidates.push({ rowNumber, data });
    }
  }

  // 2) duplikat di dalam file
  const seenEngine = new Map();
  const seenFrame = new Map();
  const afterFile = [];
  for (const c of candidates) {
    const reasons = [];
    const ek = key(c.data.engine_number);
    const fk = key(c.data.frame_number);
    if (seenEngine.has(ek)) reasons.push(`${LABELS.engine_number} duplikat di dalam file (sama dengan baris ${seenEngine.get(ek)}).`);
    if (seenFrame.has(fk)) reasons.push(`${LABELS.frame_number} duplikat di dalam file (sama dengan baris ${seenFrame.get(fk)}).`);
    if (reasons.length) {
      failed.push({ row: c.rowNumber, channel: c.data.channel, engine_number: c.data.engine_number, frame_number: c.data.frame_number, reasons });
    } else {
      seenEngine.set(ek, c.rowNumber);
      seenFrame.set(fk, c.rowNumber);
      afterFile.push(c);
    }
  }

  // 3) duplikat terhadap database
  const [existEngine, existFrame] = await Promise.all([
    findExisting(pool, 'engine_number', afterFile.map((c) => c.data.engine_number)),
    findExisting(pool, 'frame_number', afterFile.map((c) => c.data.frame_number)),
  ]);
  const valid = [];
  for (const c of afterFile) {
    const reasons = [];
    if (existEngine.has(key(c.data.engine_number))) reasons.push(`${LABELS.engine_number} sudah terdaftar di database.`);
    if (existFrame.has(key(c.data.frame_number))) reasons.push(`${LABELS.frame_number} sudah terdaftar di database.`);
    if (reasons.length) {
      failed.push({ row: c.rowNumber, channel: c.data.channel, engine_number: c.data.engine_number, frame_number: c.data.frame_number, reasons });
    } else {
      valid.push(c);
    }
  }

  const summary = (imported) => ({
    sheet: sheetName,
    dry_run: dryRun,
    total_rows: rows.length,
    valid: valid.length,
    imported,
    failed: failed.length,
    duplicates: failed.filter((f) => f.reasons.some((r) => /duplikat|sudah terdaftar/.test(r))).length,
    errors: failed.sort((a, b) => a.row - b.row).slice(0, MAX_ERRORS_RETURNED),
    errors_truncated: failed.length > MAX_ERRORS_RETURNED,
  });

  if (dryRun || valid.length === 0) return summary(0);

  // 4) nomor urut per channel untuk baris tanpa "No."
  const channels = [...new Set(valid.map((c) => c.data.channel))];
  const [maxRows] = await pool.query('SELECT channel, MAX(channel_no) AS m FROM motorcycles WHERE channel IN (?) GROUP BY channel', [channels]);
  const counters = new Map(maxRows.map((r) => [key(r.channel), r.m || 0]));
  for (const c of valid) {
    const k = key(c.data.channel);
    if (c.data.channel_no == null) {
      const next = (counters.get(k) || 0) + 1;
      c.data.channel_no = next;
      counters.set(k, next);
    } else if ((counters.get(k) || 0) < c.data.channel_no) {
      counters.set(k, c.data.channel_no);
    }
  }

  // 5) simpan dalam satu transaksi, per chunk
  let imported = 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < valid.length; i += CHUNK) {
      const part = valid.slice(i, i + CHUNK);
      try {
        await conn.query(`INSERT INTO motorcycles (${INSERT_COLS.join(', ')}) VALUES ?`, [part.map((c) => toValues(c.data))]);
        imported += part.length;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
        // Ada duplikat yang lolos pengecekan (mis. import bersamaan) -> simpan satu per satu
        for (const c of part) {
          try {
            await conn.query(`INSERT INTO motorcycles (${INSERT_COLS.join(', ')}) VALUES (?)`, [toValues(c.data)]);
            imported += 1;
          } catch (e) {
            if (e.code !== 'ER_DUP_ENTRY') throw e;
            failed.push({ row: c.rowNumber, channel: c.data.channel, engine_number: c.data.engine_number, frame_number: c.data.frame_number, reasons: ['Nomor Mesin atau Nomor Rangka sudah terdaftar di database.'] });
          }
        }
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  return summary(imported);
}

module.exports = { importInventory };
