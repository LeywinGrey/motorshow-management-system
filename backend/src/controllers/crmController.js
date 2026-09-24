const pool = require('../config/db');

async function assertCustomerAccess(req, customerId) {
  const [rows] = await pool.query('SELECT assigned_sales_id FROM customers WHERE id = ?', [customerId]);
  if (!rows[0]) return { exists: false, allowed: false };
  if (req.user.role === 'admin') return { exists: true, allowed: true };
  return { exists: true, allowed: rows[0].assigned_sales_id === req.user.id };
}

// GET /api/customers/:customerId/activities - riwayat aktivitas (timeline), dengan filter
async function getActivities(req, res, next) {
  try {
    const { customerId } = req.params;
    const { activity_type } = req.query;

    const access = await assertCustomerAccess(req, customerId);
    if (!access.exists) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    if (!access.allowed) return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data ini.' });

    const conditions = ['ca.customer_id = ?'];
    const values = [customerId];
    if (activity_type) { conditions.push('ca.activity_type = ?'); values.push(activity_type); }

    const [rows] = await pool.query(
      `SELECT ca.*, u.name as sales_name
       FROM crm_activities ca
       JOIN users u ON ca.sales_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY ca.activity_date DESC`,
      values
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/customers/:customerId/activities
async function createActivity(req, res, next) {
  try {
    const { customerId } = req.params;
    const { activity_type, activity_date, notes } = req.body;

    const access = await assertCustomerAccess(req, customerId);
    if (!access.exists) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });
    if (!access.allowed) return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data ini.' });

    if (!activity_type) return res.status(400).json({ success: false, message: 'Jenis aktivitas wajib diisi.' });

    const salesId = req.user.role === 'sales' ? req.user.id : (req.body.sales_id || req.user.id);
    const [result] = await pool.query(
      `INSERT INTO crm_activities (customer_id, sales_id, activity_type, activity_date, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [customerId, salesId, activity_type, activity_date || new Date(), notes || null]
    );
    res.status(201).json({ success: true, message: 'Aktivitas berhasil dicatat.', data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/activities/:id
async function updateActivity(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM crm_activities WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Aktivitas tidak ditemukan.' });
    if (req.user.role === 'sales' && rows[0].sales_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses untuk mengubah aktivitas ini.' });
    }

    const { activity_type, activity_date, notes } = req.body;
    const fields = [];
    const values = [];
    if (activity_type) { fields.push('activity_type = ?'); values.push(activity_type); }
    if (activity_date) { fields.push('activity_date = ?'); values.push(activity_date); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
    if (fields.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });

    values.push(id);
    await pool.query(`UPDATE crm_activities SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Aktivitas berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/activities/:id
async function deleteActivity(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM crm_activities WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Aktivitas tidak ditemukan.' });
    if (req.user.role === 'sales' && rows[0].sales_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses untuk menghapus aktivitas ini.' });
    }
    await pool.query('DELETE FROM crm_activities WHERE id = ?', [id]);
    res.json({ success: true, message: 'Aktivitas berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getActivities, createActivity, updateActivity, deleteActivity };
