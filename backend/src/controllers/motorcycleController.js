const pool = require('../config/db');
const { validateMotor } = require('../utils/inventoryValidator');
const { importRows } = require('../services/inventoryImport');

const MAX_LIMIT = 1000;

// ---------- helper ----------

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

/** Bangun klausa WHERE dari query string (dipakai list, export, dan ringkasan stok). */
function buildFilters(query) {
  const { search, channel, type_code, color, year, supplier, status, brand, model } = query;
  const conditions = [];
  const values = [];

  if (search && String(search).trim()) {
    const like = `%${escapeLike(String(search).trim())}%`;
    // Nomor Mesin, Nomor Rangka, Nama Tipe Motor, Tipe Motor, Channel (+ merek: kompatibel dengan pencarian lama)
    conditions.push('(engine_number LIKE ? OR chassis_number LIKE ? OR model LIKE ? OR type_code LIKE ? OR channel LIKE ? OR brand LIKE ?)');
    values.push(like, like, like, like, like, like);
  }
  const exact = { channel, type_code, color, year, supplier, status, brand, model };
  Object.entries(exact).forEach(([col, val]) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      conditions.push(`${col} = ?`);
      values.push(String(val).trim());
    }
  });

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

const ORDER_DEFAULT = 'ORDER BY channel ASC, channel_no ASC, id ASC'; // urutan seperti di Excel

function badRequest(res, errors) {
  return res.status(400).json({ success: false, message: errors.join('; '), errors });
}

function duplicateResponse(res, err) {
  const msg = String(err.sqlMessage || '');
  const message = /engine/i.test(msg)
    ? 'Nomor Mesin sudah terdaftar.'
    : /chassis/i.test(msg)
      ? 'Nomor Rangka sudah terdaftar.'
      : 'Nomor Mesin atau Nomor Rangka sudah terdaftar.';
  return res.status(409).json({ success: false, message });
}

/** Cek duplikat Nomor Mesin / Rangka; excludeId dipakai saat edit. Return array pesan error. */
async function findDuplicates(conn, { engine_number, chassis_number }, excludeId = null) {
  const errors = [];
  if (engine_number) {
    const [rows] = await conn.query('SELECT id FROM motorcycles WHERE engine_number = ? AND id <> ? LIMIT 1', [engine_number, excludeId || 0]);
    if (rows.length) errors.push('Nomor Mesin sudah terdaftar');
  }
  if (chassis_number) {
    const [rows] = await conn.query('SELECT id FROM motorcycles WHERE chassis_number = ? AND id <> ? LIMIT 1', [chassis_number, excludeId || 0]);
    if (rows.length) errors.push('Nomor Rangka sudah terdaftar');
  }
  return errors;
}

async function nextChannelNo(conn, channel) {
  const [[row]] = await conn.query('SELECT COALESCE(MAX(channel_no), 0) + 1 AS n FROM motorcycles WHERE channel = ? FOR UPDATE', [channel]);
  return Number(row.n);
}

// ---------- endpoint ----------

// GET /api/motorcycles - list dengan search, filter, pagination
async function getMotorcycles(req, res, next) {
  try {
    const { sortPrice, page = 1, limit = 12 } = req.query;
    const { where, values } = buildFilters(req.query);

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || 12));
    const orderClause = sortPrice === 'asc' ? 'ORDER BY price ASC' : sortPrice === 'desc' ? 'ORDER BY price DESC' : ORDER_DEFAULT;

    const [rows] = await pool.query(
      `SELECT * FROM motorcycles ${where} ${orderClause} LIMIT ? OFFSET ?`,
      [...values, limitNum, (pageNum - 1) * limitNum]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM motorcycles ${where}`, values);
    const total = countRows[0].total;

    res.json({
      success: true,
      data: rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/motorcycles/summary - jumlah motor per status untuk dashboard inventory
async function getMotorcycleSummary(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(status='Tersedia') as tersedia,
        SUM(status='Dibooking') as dibooking,
        SUM(status='Test Drive') as test_drive,
        SUM(status='Terjual') as terjual
      FROM motorcycles`
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// GET /api/motorcycles/stock-summary - stok per Tipe Motor + Warna (mengikuti filter yang aktif)
async function getStockSummary(req, res, next) {
  try {
    const { where, values } = buildFilters(req.query);
    const [rows] = await pool.query(
      `SELECT type_code, model, color_code, color, COUNT(*) AS total, SUM(status = 'Tersedia') AS tersedia
       FROM motorcycles ${where}
       GROUP BY type_code, model, color_code, color
       ORDER BY model ASC, color ASC`,
      values
    );
    res.json({
      success: true,
      data: rows.map((r) => ({ ...r, total: Number(r.total), tersedia: Number(r.tersedia) })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/motorcycles/filters - pilihan dropdown filter
async function getFilterOptions(req, res, next) {
  try {
    const distinct = async (sql) => (await pool.query(sql))[0];
    const [channels, types, colors, years, suppliers] = await Promise.all([
      distinct("SELECT DISTINCT channel AS value FROM motorcycles WHERE channel IS NOT NULL AND channel <> '' ORDER BY channel"),
      distinct("SELECT DISTINCT type_code, model FROM motorcycles WHERE type_code IS NOT NULL AND type_code <> '' ORDER BY model, type_code"),
      distinct("SELECT DISTINCT color AS value FROM motorcycles WHERE color IS NOT NULL AND color <> '' ORDER BY color"),
      distinct('SELECT DISTINCT year AS value FROM motorcycles ORDER BY year DESC'),
      distinct("SELECT DISTINCT supplier AS value FROM motorcycles WHERE supplier IS NOT NULL AND supplier <> '' ORDER BY supplier"),
    ]);
    res.json({
      success: true,
      data: {
        channels: channels.map((r) => r.value),
        types: types.map((r) => ({ type_code: r.type_code, model: r.model })),
        colors: colors.map((r) => r.value),
        years: years.map((r) => r.value),
        suppliers: suppliers.map((r) => r.value),
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/motorcycles/export - seluruh data sesuai filter (tanpa pagination), urutan seperti Excel
async function exportMotorcycles(req, res, next) {
  try {
    const { where, values } = buildFilters(req.query);
    const [rows] = await pool.query(
      `SELECT id, channel, channel_no, type_code, model, color_code, color, year,
              engine_number, chassis_number, purchase_date, display_date, friction, supplier, status
       FROM motorcycles ${where} ${ORDER_DEFAULT}`,
      values
    );
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/motorcycles/import - body: { rows: [...], dryRun?: boolean }
async function importMotorcycles(req, res, next) {
  try {
    const { rows, dryRun } = req.body || {};
    const result = await importRows(pool, rows, { dryRun: dryRun === true || dryRun === 'true' });
    res.json({ success: true, dryRun: !!dryRun, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/motorcycles/:id
async function getMotorcycleById(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM motorcycles WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Motor tidak ditemukan.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/motorcycles
async function createMotorcycle(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { data, errors } = validateMotor(req.body);
    if (errors.length) return badRequest(res, errors);

    const dupErrors = await findDuplicates(conn, data);
    if (dupErrors.length) return res.status(409).json({ success: false, message: dupErrors.join('; '), errors: dupErrors });

    await conn.beginTransaction();
    if (data.channel_no == null) data.channel_no = await nextChannelNo(conn, data.channel);

    const image = req.file ? `/uploads/motorcycles/${req.file.filename}` : null;
    const record = { brand: 'Honda', status: 'Tersedia', price: null, ...data, image };
    const cols = Object.keys(record);
    const [result] = await conn.query(
      `INSERT INTO motorcycles (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => record[c])
    );
    await conn.commit();
    res.status(201).json({ success: true, message: 'Motor berhasil ditambahkan.', data: { id: result.insertId, channel_no: data.channel_no } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return duplicateResponse(res, err);
    next(err);
  } finally {
    conn.release();
  }
}

// PUT /api/motorcycles/:id (parsial: hanya field yang dikirim yang diubah; field opsional boleh dikosongkan)
async function updateMotorcycle(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [existingRows] = await conn.query('SELECT * FROM motorcycles WHERE id = ?', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Motor tidak ditemukan.' });

    const { data, errors } = validateMotor(req.body, { partial: true });
    if (errors.length) return badRequest(res, errors);
    if (req.file) data.image = `/uploads/motorcycles/${req.file.filename}`;
    if (Object.keys(data).length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });

    const dupErrors = await findDuplicates(conn, data, Number(id));
    if (dupErrors.length) return res.status(409).json({ success: false, message: dupErrors.join('; '), errors: dupErrors });

    await conn.beginTransaction();
    // Pindah channel tanpa menentukan No. -> lanjutkan nomor urut channel tujuan
    const channelChanged = data.channel && String(data.channel).toLowerCase() !== String(existing.channel || '').toLowerCase();
    if (channelChanged && (!Object.prototype.hasOwnProperty.call(req.body, 'channel_no') || data.channel_no == null)) {
      data.channel_no = await nextChannelNo(conn, data.channel);
    }

    const cols = Object.keys(data);
    await conn.query(`UPDATE motorcycles SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => data[c]), id]);
    await conn.commit();
    res.json({ success: true, message: 'Motor berhasil diperbarui.' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return duplicateResponse(res, err);
    next(err);
  } finally {
    conn.release();
  }
}

// DELETE /api/motorcycles/:id
// Ditolak bila unit masih terhubung ke booking test drive / pelanggan, supaya riwayat Sales tidak rusak
// (FK bookings = ON DELETE CASCADE, customers = SET NULL, sehingga DELETE langsung akan menghapus/memutus data tsb).
async function deleteMotorcycle(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT id FROM motorcycles WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Motor tidak ditemukan.' });

    const [[b]] = await pool.query('SELECT COUNT(*) AS n FROM test_drive_bookings WHERE motorcycle_id = ?', [id]);
    const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM customers WHERE interested_motorcycle_id = ?', [id]);
    if (b.n > 0 || c.n > 0) {
      const parts = [];
      if (b.n > 0) parts.push(`${b.n} booking test drive`);
      if (c.n > 0) parts.push(`${c.n} pelanggan`);
      return res.status(409).json({
        success: false,
        message: `Unit tidak dapat dihapus karena masih terhubung dengan ${parts.join(' dan ')}. Selesaikan/hapus data terkait terlebih dahulu.`,
      });
    }

    await pool.query('DELETE FROM motorcycles WHERE id = ?', [id]);
    res.json({ success: true, message: 'Motor berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMotorcycles,
  getMotorcycleSummary,
  getStockSummary,
  getFilterOptions,
  exportMotorcycles,
  importMotorcycles,
  getMotorcycleById,
  createMotorcycle,
  updateMotorcycle,
  deleteMotorcycle,
  buildFilters,
};
