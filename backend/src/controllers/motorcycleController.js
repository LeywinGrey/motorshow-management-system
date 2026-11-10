const pool = require('../config/db');
const { validateMotorPayload, LABELS } = require('../utils/motorInventory');
const { buildInventoryWorkbook } = require('../utils/inventoryExcel');
const { importInventory } = require('../services/inventoryImportService');

const MAX_LIMIT = 1000; // Booking & Customers memuat daftar motor dengan limit=1000

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

// Membangun WHERE dari query string (dipakai list, stock-summary, dan export agar filternya identik)
function buildWhere(q) {
  const conditions = [];
  const values = [];
  const search = q.search ? String(q.search).trim() : '';
  if (search) {
    const like = `%${escapeLike(search)}%`;
    conditions.push('(engine_number LIKE ? OR frame_number LIKE ? OR model LIKE ? OR type_code LIKE ? OR channel LIKE ? OR brand LIKE ?)');
    values.push(like, like, like, like, like, like);
  }
  const exact = { channel: 'channel', supplier: 'supplier', year: 'year', color: 'color', type_code: 'type_code', model: 'model', brand: 'brand', status: 'status' };
  Object.entries(exact).forEach(([param, col]) => {
    if (q[param] !== undefined && q[param] !== '') { conditions.push(`${col} = ?`); values.push(q[param]); }
  });
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

const ORDER_DEFAULT = 'ORDER BY (channel IS NULL), channel ASC, channel_no ASC, id ASC';

function validationFail(res, errors, status = 400) {
  return res.status(status).json({ success: false, message: errors.map((e) => e.message).join(' '), errors });
}

async function findDuplicates(data, excludeId) {
  const cond = [];
  const vals = [];
  if (data.engine_number) { cond.push('engine_number = ?'); vals.push(data.engine_number); }
  if (data.frame_number) { cond.push('frame_number = ?'); vals.push(data.frame_number); }
  if (!cond.length) return [];
  let sql = `SELECT id, engine_number, frame_number FROM motorcycles WHERE (${cond.join(' OR ')})`;
  if (excludeId) { sql += ' AND id <> ?'; vals.push(excludeId); }
  const [rows] = await pool.query(sql, vals);
  const errors = [];
  const same = (a, b) => a && b && String(a).toLowerCase() === String(b).toLowerCase();
  if (rows.some((r) => same(r.engine_number, data.engine_number))) errors.push({ field: 'engine_number', message: `${LABELS.engine_number} sudah terdaftar.` });
  if (rows.some((r) => same(r.frame_number, data.frame_number))) errors.push({ field: 'frame_number', message: `${LABELS.frame_number} sudah terdaftar.` });
  return errors;
}

// GET /api/motorcycles - list + search + filter + pagination (Admin & Sales)
async function getMotorcycles(req, res, next) {
  try {
    const { sortPrice, page = 1, limit = 25 } = req.query;
    const { where, values } = buildWhere(req.query);
    const orderClause = sortPrice === 'asc' ? 'ORDER BY price ASC' : sortPrice === 'desc' ? 'ORDER BY price DESC' : ORDER_DEFAULT;

    const lim = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 25));
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const [rows] = await pool.query(`SELECT * FROM motorcycles ${where} ${orderClause} LIMIT ? OFFSET ?`, [...values, lim, (pg - 1) * lim]);
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM motorcycles ${where}`, values);

    res.json({
      success: true,
      data: rows,
      pagination: { page: pg, limit: lim, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / lim) },
    });
  } catch (err) { next(err); }
}

// GET /api/motorcycles/summary - total stok per status (tanpa filter)
async function getMotorcycleSummary(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total, SUM(status='Tersedia') AS tersedia, SUM(status='Dibooking') AS dibooking,
              SUM(status='Test Drive') AS test_drive, SUM(status='Terjual') AS terjual
       FROM motorcycles`
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

// GET /api/motorcycles/stock-summary - stok per tipe motor & warna (mengikuti filter aktif)
async function getStockSummary(req, res, next) {
  try {
    const { where, values } = buildWhere(req.query);
    const [rows] = await pool.query(
      `SELECT type_code, model, color_code, color, COUNT(*) AS total, SUM(status='Tersedia') AS tersedia
       FROM motorcycles ${where}
       GROUP BY type_code, model, color_code, color
       ORDER BY model ASC, color ASC`,
      values
    );
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    res.json({ success: true, data: { total, items: rows.map((r) => ({ ...r, total: Number(r.total), tersedia: Number(r.tersedia) })) } });
  } catch (err) { next(err); }
}

// GET /api/motorcycles/filter-options - isi dropdown filter & saran isian form
async function getFilterOptions(req, res, next) {
  try {
    const distinct = async (col) => {
      const [r] = await pool.query(`SELECT DISTINCT ${col} AS v FROM motorcycles WHERE ${col} IS NOT NULL AND ${col} <> '' ORDER BY ${col}`);
      return r.map((x) => x.v);
    };
    const [channels, suppliers, colors, typeCodes] = await Promise.all([
      distinct('channel'), distinct('supplier'), distinct('color'), distinct('type_code'),
    ]);
    const [years] = await pool.query('SELECT DISTINCT year AS v FROM motorcycles WHERE year IS NOT NULL ORDER BY year DESC');
    const [types] = await pool.query("SELECT type_code, MIN(model) AS model FROM motorcycles WHERE type_code IS NOT NULL AND type_code <> '' GROUP BY type_code ORDER BY type_code");
    const [colorPairs] = await pool.query("SELECT color_code, MIN(color) AS color FROM motorcycles WHERE color_code IS NOT NULL AND color_code <> '' GROUP BY color_code ORDER BY color_code");
    res.json({ success: true, data: { channels, suppliers, colors, type_codes: typeCodes, years: years.map((y) => y.v), types, color_pairs: colorPairs } });
  } catch (err) { next(err); }
}

// GET /api/motorcycles/:id
async function getMotorcycleById(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM motorcycles WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Motor tidak ditemukan.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
}

// POST /api/motorcycles (Admin)
async function createMotorcycle(req, res, next) {
  try {
    const { data, errors } = validateMotorPayload(req.body, { partial: false });
    if (errors.length) return validationFail(res, errors);
    const dups = await findDuplicates(data);
    if (dups.length) return validationFail(res, dups, 409);

    // Nomor urut otomatis per channel jika tidak diisi
    if (data.channel_no == null) {
      const [r] = await pool.query('SELECT COALESCE(MAX(channel_no), 0) + 1 AS next FROM motorcycles WHERE channel = ?', [data.channel]);
      data.channel_no = r[0].next;
    }
    const extra = {};
    if (req.body.status && ['Tersedia', 'Dibooking', 'Test Drive', 'Terjual'].includes(req.body.status)) extra.status = req.body.status;
    if (req.file) extra.image = `/uploads/motorcycles/${req.file.filename}`;
    const row = { brand: req.body.brand || 'Honda', ...data, ...extra };
    const cols = Object.keys(row);
    const [result] = await pool.query(`INSERT INTO motorcycles (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c]));
    res.status(201).json({ success: true, message: 'Motor berhasil ditambahkan.', data: { id: result.insertId, channel_no: data.channel_no } });
  } catch (err) { next(err); }
}

// PUT /api/motorcycles/:id (Admin)
async function updateMotorcycle(req, res, next) {
  try {
    const { id } = req.params;
    const [exist] = await pool.query('SELECT id FROM motorcycles WHERE id = ?', [id]);
    if (!exist[0]) return res.status(404).json({ success: false, message: 'Motor tidak ditemukan.' });

    const { data, errors } = validateMotorPayload(req.body, { partial: true });
    if (errors.length) return validationFail(res, errors);
    const dups = await findDuplicates(data, id);
    if (dups.length) return validationFail(res, dups, 409);

    if (req.file) data.image = `/uploads/motorcycles/${req.file.filename}`;
    const cols = Object.keys(data);
    if (!cols.length) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });
    await pool.query(`UPDATE motorcycles SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => data[c]), id]);
    res.json({ success: true, message: 'Motor berhasil diperbarui.' });
  } catch (err) { next(err); }
}

// DELETE /api/motorcycles/:id (Admin) - ditolak jika unit sudah terhubung ke transaksi
async function deleteMotorcycle(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id, status, engine_number FROM motorcycles WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Motor tidak ditemukan.' });

    const [[b]] = await pool.query('SELECT COUNT(*) AS n FROM test_drive_bookings WHERE motorcycle_id = ?', [id]);
    const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM customers WHERE interested_motorcycle_id = ?', [id]);
    const reasons = [];
    if (rows[0].status === 'Terjual') reasons.push('unit berstatus Terjual');
    if (b.n > 0) reasons.push(`terhubung ke ${b.n} booking test drive`);
    if (c.n > 0) reasons.push(`menjadi motor diminati ${c.n} pelanggan`);
    if (reasons.length) {
      return res.status(409).json({ success: false, message: `Unit tidak dapat dihapus karena ${reasons.join(', ')}. Ubah atau hapus data terkait terlebih dahulu.` });
    }
    await pool.query('DELETE FROM motorcycles WHERE id = ?', [id]);
    res.json({ success: true, message: 'Motor berhasil dihapus.' });
  } catch (err) { next(err); }
}

// POST /api/motorcycles/import (Admin) - multipart field "file", opsional dry_run=true
async function importMotorcycles(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File Excel belum dipilih.' });
    const dryRun = String(req.body.dry_run || '').toLowerCase() === 'true';
    let result;
    try {
      result = await importInventory(pool, req.file.buffer, { dryRun });
    } catch (e) {
      if (e.code || e.sqlMessage) throw e; // error database -> errorHandler
      return res.status(400).json({ success: false, message: e.message });
    }
    const msg = dryRun
      ? `Pemeriksaan selesai: ${result.valid} baris valid, ${result.failed} bermasalah.`
      : `Import selesai: ${result.imported} berhasil, ${result.failed} gagal.`;
    res.json({ success: true, message: msg, data: result });
  } catch (err) { next(err); }
}

// GET /api/motorcycles/export (Admin) - mengikuti filter yang sama dengan list
async function exportMotorcycles(req, res, next) {
  try {
    const { where, values } = buildWhere(req.query);
    const [rows] = await pool.query(`SELECT * FROM motorcycles ${where} ${ORDER_DEFAULT}`, values);
    const wb = await buildInventoryWorkbook(rows);
    const buf = await wb.xlsx.writeBuffer();
    const d = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="STOK UNIT MM ${d}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
}

// GET /api/motorcycles/import-template (Admin) - template kosong berformat STOK UNIT MM
async function downloadTemplate(req, res, next) {
  try {
    const wb = await buildInventoryWorkbook([]);
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-stok-unit.xlsx"');
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
}

module.exports = {
  getMotorcycles, getMotorcycleSummary, getStockSummary, getFilterOptions, getMotorcycleById,
  createMotorcycle, updateMotorcycle, deleteMotorcycle, importMotorcycles, exportMotorcycles, downloadTemplate,
};
