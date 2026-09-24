const pool = require('../config/db');
const { isValidYear, isValidPrice } = require('../utils/validators');

// GET /api/motorcycles - list dengan search, filter, sort, pagination
async function getMotorcycles(req, res, next) {
  try {
    const { search, brand, model, year, status, sortPrice, page = 1, limit = 12 } = req.query;
    const conditions = [];
    const values = [];

    if (search) {
      conditions.push('(brand LIKE ? OR model LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
    }
    if (brand) { conditions.push('brand = ?'); values.push(brand); }
    if (model) { conditions.push('model = ?'); values.push(model); }
    if (year) { conditions.push('year = ?'); values.push(year); }
    if (status) { conditions.push('status = ?'); values.push(status); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = sortPrice === 'asc' ? 'ORDER BY price ASC' : sortPrice === 'desc' ? 'ORDER BY price DESC' : 'ORDER BY created_at DESC';

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(
      `SELECT * FROM motorcycles ${whereClause} ${orderClause} LIMIT ? OFFSET ?`,
      [...values, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM motorcycles ${whereClause}`, values);

    res.json({
      success: true,
      data: rows,
      pagination: { page: Number(page), limit: Number(limit), total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / Number(limit)) },
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
  try {
    const { brand, model, year, color, price, status } = req.body;
    if (!brand || !model || !year || !color || !price) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    if (!isValidYear(year)) return res.status(400).json({ success: false, message: 'Tahun motor tidak valid.' });
    if (!isValidPrice(price)) return res.status(400).json({ success: false, message: 'Harga harus berupa angka positif.' });

    const image = req.file ? `/uploads/motorcycles/${req.file.filename}` : null;
    const [result] = await pool.query(
      'INSERT INTO motorcycles (brand, model, year, color, price, image, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [brand, model, year, color, price, image, status || 'Tersedia']
    );
    res.status(201).json({ success: true, message: 'Motor berhasil ditambahkan.', data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/motorcycles/:id
async function updateMotorcycle(req, res, next) {
  try {
    const { id } = req.params;
    const { brand, model, year, color, price, status } = req.body;

    if (year && !isValidYear(year)) return res.status(400).json({ success: false, message: 'Tahun motor tidak valid.' });
    if (price && !isValidPrice(price)) return res.status(400).json({ success: false, message: 'Harga harus berupa angka positif.' });

    // Validasi: motor terjual tidak dapat diubah kembali ke status yang menyiratkan tersedia untuk test drive tanpa disengaja
    const fields = [];
    const values = [];
    if (brand) { fields.push('brand = ?'); values.push(brand); }
    if (model) { fields.push('model = ?'); values.push(model); }
    if (year) { fields.push('year = ?'); values.push(year); }
    if (color) { fields.push('color = ?'); values.push(color); }
    if (price) { fields.push('price = ?'); values.push(price); }
    if (status) { fields.push('status = ?'); values.push(status); }
    if (req.file) { fields.push('image = ?'); values.push(`/uploads/motorcycles/${req.file.filename}`); }

    if (fields.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });
    values.push(id);
    await pool.query(`UPDATE motorcycles SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Motor berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/motorcycles/:id
async function deleteMotorcycle(req, res, next) {
  try {
    await pool.query('DELETE FROM motorcycles WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Motor berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMotorcycles,
  getMotorcycleSummary,
  getMotorcycleById,
  createMotorcycle,
  updateMotorcycle,
  deleteMotorcycle,
};
