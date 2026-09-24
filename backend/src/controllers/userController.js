const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { isValidEmail } = require('../utils/validators');

// GET /api/users  (Admin only) - Manajemen Pengguna
async function getUsers(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, phone, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/sales - daftar sales (untuk dropdown assign)
async function getSalesList(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, phone FROM users WHERE role = 'sales' AND is_active = 1 ORDER BY name"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/users (Admin only)
async function createUser(req, res, next) {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Nama, email, password, dan role wajib diisi.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
    }
    if (!['admin', 'sales'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role harus admin atau sales.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashed, role, phone || null]
    );
    res.status(201).json({ success: true, message: 'User berhasil dibuat.', data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/:id (Admin only)
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, role, phone, is_active, password } = req.body;

    const fields = [];
    const values = [];
    if (name) { fields.push('name = ?'); values.push(name); }
    if (email) {
      if (!isValidEmail(email)) return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
      fields.push('email = ?'); values.push(email);
    }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      fields.push('password = ?'); values.push(hashed);
    }
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });
    }
    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'User berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id (Admin only)
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    if (Number(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menghapus akun sendiri.' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getUsers, getSalesList, createUser, updateUser, deleteUser };
