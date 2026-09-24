const pool = require('../config/db');
const { isValidEmail, isValidPhone } = require('../utils/validators');

// GET /api/customers - search, filter status, sales melihat data sendiri
async function getCustomers(req, res, next) {
  try {
    const { search, status, sales_id, page = 1, limit = 15 } = req.query;
    const conditions = [];
    const values = [];

    if (req.user.role === 'sales') {
      conditions.push('c.assigned_sales_id = ?');
      values.push(req.user.id);
    } else if (sales_id) {
      conditions.push('c.assigned_sales_id = ?');
      values.push(sales_id);
    }

    if (search) {
      conditions.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)');
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) { conditions.push('c.status = ?'); values.push(status); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT c.*, m.brand as motor_brand, m.model as motor_model, u.name as sales_name
       FROM customers c
       LEFT JOIN motorcycles m ON c.interested_motorcycle_id = m.id
       LEFT JOIN users u ON c.assigned_sales_id = u.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM customers c ${whereClause}`, values);

    res.json({
      success: true,
      data: rows,
      pagination: { page: Number(page), limit: Number(limit), total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
}

async function assertSalesOwnership(req, customerId) {
  if (req.user.role !== 'sales') return true;
  const [rows] = await pool.query('SELECT assigned_sales_id FROM customers WHERE id = ?', [customerId]);
  return rows[0] && rows[0].assigned_sales_id === req.user.id;
}

// GET /api/customers/:id
async function getCustomerById(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, m.brand as motor_brand, m.model as motor_model, u.name as sales_name
       FROM customers c
       LEFT JOIN motorcycles m ON c.interested_motorcycle_id = m.id
       LEFT JOIN users u ON c.assigned_sales_id = u.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan.' });

    if (req.user.role === 'sales' && rows[0].assigned_sales_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data pelanggan ini.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/customers
async function createCustomer(req, res, next) {
  try {
    const { name, phone, email, address, interested_motorcycle_id, assigned_sales_id, status } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Nama dan nomor HP wajib diisi.' });
    }
    if (!isValidPhone(phone)) return res.status(400).json({ success: false, message: 'Nomor HP tidak valid.' });
    if (email && !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Format email tidak valid.' });

    const salesId = req.user.role === 'sales' ? req.user.id : (assigned_sales_id || null);

    const [result] = await pool.query(
      `INSERT INTO customers (name, phone, email, address, interested_motorcycle_id, assigned_sales_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, address || null, interested_motorcycle_id || null, salesId, status || 'Lead']
    );
    res.status(201).json({ success: true, message: 'Pelanggan berhasil ditambahkan.', data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/customers/:id
async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = await assertSalesOwnership(req, id);
    if (!allowed) return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke data pelanggan ini.' });

    const { name, phone, email, address, interested_motorcycle_id, assigned_sales_id, status } = req.body;
    if (phone && !isValidPhone(phone)) return res.status(400).json({ success: false, message: 'Nomor HP tidak valid.' });
    if (email && !isValidEmail(email)) return res.status(400).json({ success: false, message: 'Format email tidak valid.' });

    const fields = [];
    const values = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (phone) { fields.push('phone = ?'); values.push(phone); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }
    if (interested_motorcycle_id !== undefined) { fields.push('interested_motorcycle_id = ?'); values.push(interested_motorcycle_id || null); }
    if (assigned_sales_id !== undefined && req.user.role === 'admin') { fields.push('assigned_sales_id = ?'); values.push(assigned_sales_id || null); }
    if (status) { fields.push('status = ?'); values.push(status); }

    if (fields.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });
    values.push(id);
    await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Data pelanggan berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/customers/:id/assign (Admin only) - assign pelanggan ke sales
async function assignSales(req, res, next) {
  try {
    const { id } = req.params;
    const { assigned_sales_id } = req.body;
    if (!assigned_sales_id) return res.status(400).json({ success: false, message: 'Sales wajib dipilih.' });
    await pool.query('UPDATE customers SET assigned_sales_id = ? WHERE id = ?', [assigned_sales_id, id]);
    res.json({ success: true, message: 'Pelanggan berhasil di-assign ke sales.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/customers/:id
async function deleteCustomer(req, res, next) {
  try {
    await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Pelanggan berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, assignSales, deleteCustomer };
