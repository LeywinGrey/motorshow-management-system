/**
 * Import massal unit motor (dipakai endpoint POST /api/motorcycles/import dan CLI import-stok).
 *
 * Alur: validasi tiap baris -> deteksi duplikat dalam file -> deteksi duplikat di database
 *       -> (jika bukan dryRun) INSERT baris yang valid. Baris bermasalah dilewati dan dilaporkan
 *       beserta alasannya; baris valid tetap tersimpan.
 */
const { validateMotor } = require('../utils/inventoryValidator');

const INSERT_COLUMNS = [
  'brand', 'model', 'year', 'color', 'price', 'status',
  'channel', 'channel_no', 'type_code', 'color_code',
  'engine_number', 'chassis_number', 'purchase_date', 'display_date', 'friction', 'supplier',
];
const BATCH_SIZE = 100;
const MAX_ROWS = 2000;

const keyOf = (v) => String(v).trim().toUpperCase(); // MySQL collation *_ci: A = a

const toRowValues = (d) => INSERT_COLUMNS.map((c) => (d[c] === undefined ? null : d[c]));

function dupMessage(err) {
  const msg = String(err.sqlMessage || err.message || '');
  if (/engine/i.test(msg)) return 'Nomor Mesin sudah ada di database';
  if (/chassis/i.test(msg)) return 'Nomor Rangka sudah ada di database';
  return 'Data duplikat (Nomor Mesin / Nomor Rangka sudah ada)';
}

async function findExisting(pool, engines, chassis) {
  const engineHit = new Set();
  const chassisHit = new Set();
  for (let i = 0; i < Math.max(engines.length, chassis.length); i += 500) {
    const e = engines.slice(i, i + 500);
    const c = chassis.slice(i, i + 500);
    if (!e.length && !c.length) continue;
    const [rows] = await pool.query(
      'SELECT engine_number, chassis_number FROM motorcycles WHERE engine_number IN (?) OR chassis_number IN (?)',
      [e.length ? e : [''], c.length ? c : ['']]
    );
    rows.forEach((r) => {
      if (r.engine_number) engineHit.add(keyOf(r.engine_number));
      if (r.chassis_number) chassisHit.add(keyOf(r.chassis_number));
    });
  }
  return { engineHit, chassisHit };
}

/**
 * @param pool      mysql2 pool
 * @param rawRows   [{ row?, channel, channel_no, type_code, model, ... }]
 * @param options   { dryRun }
 * @returns { total, valid, inserted, failed: [{ row, engine_number, chassis_number, reasons[] }] }
 */
async function importRows(pool, rawRows, { dryRun = false } = {}) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    const err = new Error('Tidak ada data untuk diimport.'); err.statusCode = 400; throw err;
  }
  if (rawRows.length > MAX_ROWS) {
    const err = new Error(`Maksimal ${MAX_ROWS} baris per import.`); err.statusCode = 400; throw err;
  }

  const items = rawRows.map((raw, i) => {
    const row = Number.isInteger(raw?.row) ? raw.row : i + 1;
    const { data, errors } = validateMotor(raw || {});
    return { row, raw: raw || {}, data, errors: [...errors] };
  });

  // Duplikat di dalam file yang sama
  const seenEngine = new Map();
  const seenChassis = new Map();
  items.forEach((it) => {
    if (it.data.engine_number) {
      const k = keyOf(it.data.engine_number);
      if (seenEngine.has(k)) it.errors.push(`Nomor Mesin duplikat dengan baris ${seenEngine.get(k)} di file`);
      else seenEngine.set(k, it.row);
    }
    if (it.data.chassis_number) {
      const k = keyOf(it.data.chassis_number);
      if (seenChassis.has(k)) it.errors.push(`Nomor Rangka duplikat dengan baris ${seenChassis.get(k)} di file`);
      else seenChassis.set(k, it.row);
    }
  });

  // Duplikat terhadap database
  const { engineHit, chassisHit } = await findExisting(
    pool,
    items.filter((it) => it.data.engine_number).map((it) => it.data.engine_number),
    items.filter((it) => it.data.chassis_number).map((it) => it.data.chassis_number)
  );
  items.forEach((it) => {
    if (it.data.engine_number && engineHit.has(keyOf(it.data.engine_number))) it.errors.push('Nomor Mesin sudah ada di database');
    if (it.data.chassis_number && chassisHit.has(keyOf(it.data.chassis_number))) it.errors.push('Nomor Rangka sudah ada di database');
  });

  const validItems = items.filter((it) => it.errors.length === 0);
  const failedItems = items.filter((it) => it.errors.length > 0);
  const toFailed = (it) => ({
    row: it.row,
    engine_number: it.raw.engine_number ?? null,
    chassis_number: it.raw.chassis_number ?? null,
    reasons: it.errors,
  });
  const failed = failedItems.map(toFailed);

  if (dryRun || validItems.length === 0) {
    return { total: items.length, valid: validItems.length, inserted: 0, failed };
  }

  // Nomor urut per channel: pakai No. dari Excel; jika kosong, lanjutkan dari nomor terbesar channel tsb
  const needNo = validItems.filter((it) => it.data.channel_no == null);
  if (needNo.length) {
    const channels = [...new Set(needNo.map((it) => it.data.channel))];
    const [maxRows] = await pool.query(
      'SELECT channel, COALESCE(MAX(channel_no), 0) AS max_no FROM motorcycles WHERE channel IN (?) GROUP BY channel',
      [channels]
    );
    const next = new Map(maxRows.map((r) => [keyOf(r.channel), Number(r.max_no)]));
    validItems.forEach((it) => {
      if (it.data.channel_no != null) {
        const k = keyOf(it.data.channel);
        next.set(k, Math.max(next.get(k) || 0, it.data.channel_no));
      }
    });
    needNo.forEach((it) => {
      const k = keyOf(it.data.channel);
      const n = (next.get(k) || 0) + 1;
      next.set(k, n);
      it.data.channel_no = n;
    });
  }

  let inserted = 0;
  for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
    const batch = validItems.slice(i, i + BATCH_SIZE);
    const rows = batch.map((it) => toRowValues({ brand: 'Honda', status: 'Tersedia', ...it.data }));
    try {
      await pool.query(`INSERT INTO motorcycles (${INSERT_COLUMNS.join(', ')}) VALUES ?`, [rows]);
      inserted += batch.length;
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      // Race condition (ada data masuk saat import berjalan): ulangi per baris agar baris bermasalah teridentifikasi
      for (const it of batch) {
        try {
          await pool.query(`INSERT INTO motorcycles (${INSERT_COLUMNS.join(', ')}) VALUES (?)`, [toRowValues({ brand: 'Honda', status: 'Tersedia', ...it.data })]);
          inserted += 1;
        } catch (rowErr) {
          if (rowErr.code !== 'ER_DUP_ENTRY') throw rowErr;
          failed.push({ row: it.row, engine_number: it.raw.engine_number ?? null, chassis_number: it.raw.chassis_number ?? null, reasons: [dupMessage(rowErr)] });
        }
      }
    }
  }

  failed.sort((a, b) => a.row - b.row);
  return { total: items.length, valid: validItems.length, inserted, failed };
}

module.exports = { importRows, MAX_ROWS };
