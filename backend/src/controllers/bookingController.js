const pool = require('../config/db');
const generateBookingCode = require('../utils/generateBookingCode');

// GET /api/bookings - list dengan filter tanggal, sales, status
async function getBookings(req, res, next) {
  try {
    const { date, sales_id, status, page = 1, limit = 15 } = req.query;
    const conditions = [];
    const values = [];

    if (req.user.role === 'sales') {
      conditions.push('b.sales_id = ?');
      values.push(req.user.id);
    } else if (sales_id) {
      conditions.push('b.sales_id = ?');
      values.push(sales_id);
    }
    if (date) { conditions.push('b.booking_date = ?'); values.push(date); }
    if (status) { conditions.push('b.status = ?'); values.push(status); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT b.*, c.name as customer_name, c.phone as customer_phone,
              m.brand as motor_brand, m.model as motor_model, u.name as sales_name
       FROM test_drive_bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN motorcycles m ON b.motorcycle_id = m.id
       JOIN users u ON b.sales_id = u.id
       ${whereClause}
       ORDER BY b.booking_date DESC, b.booking_time DESC
       LIMIT ? OFFSET ?`,
      [...values, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM test_drive_bookings b ${whereClause}`, values);

    res.json({
      success: true,
      data: rows,
      pagination: { page: Number(page), limit: Number(limit), total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/calendar - untuk tampilan kalender (rentang tanggal)
async function getCalendar(req, res, next) {
  try {
    const { start, end } = req.query;
    const conditions = ['b.booking_date BETWEEN ? AND ?'];
    const values = [start, end];
    if (req.user.role === 'sales') {
      conditions.push('b.sales_id = ?');
      values.push(req.user.id);
    }
    const [rows] = await pool.query(
      `SELECT b.id, b.booking_code, b.booking_date, b.booking_time, b.status,
              c.name as customer_name, m.brand as motor_brand, m.model as motor_model, u.name as sales_name
       FROM test_drive_bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN motorcycles m ON b.motorcycle_id = m.id
       JOIN users u ON b.sales_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.booking_date, b.booking_time`,
      values
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:id
async function getBookingById(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, c.name as customer_name, c.phone as customer_phone,
              m.brand as motor_brand, m.model as motor_model, u.name as sales_name
       FROM test_drive_bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN motorcycles m ON b.motorcycle_id = m.id
       JOIN users u ON b.sales_id = u.id
       WHERE b.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Booking tidak ditemukan.' });
    if (req.user.role === 'sales' && rows[0].sales_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke booking ini.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

// Cek jadwal bentrok: sales yang sama tidak bisa punya 2 jadwal test drive di waktu yang sama
async function hasScheduleConflict(salesId, date, time, excludeBookingId = null) {
  let query = `SELECT id FROM test_drive_bookings
               WHERE sales_id = ? AND booking_date = ? AND booking_time = ?
               AND status IN ('Menunggu','Dikonfirmasi')`;
  const values = [salesId, date, time];
  if (excludeBookingId) {
    query += ' AND id != ?';
    values.push(excludeBookingId);
  }
  const [rows] = await pool.query(query, values);
  return rows.length > 0;
}

// POST /api/bookings
async function createBooking(req, res, next) {
  try {
    const { customer_id, motorcycle_id, sales_id, booking_date, booking_time, notes } = req.body;
    if (!customer_id || !motorcycle_id || !booking_date || !booking_time) {
      return res.status(400).json({ success: false, message: 'Pelanggan, motor, tanggal, dan jam wajib diisi.' });
    }

    const salesId = req.user.role === 'sales' ? req.user.id : (sales_id || req.user.id);

    // Validasi: motor terjual tidak dapat digunakan untuk test drive
    const [motorRows] = await pool.query('SELECT status FROM motorcycles WHERE id = ?', [motorcycle_id]);
    if (!motorRows[0]) return res.status(404).json({ success: false, message: 'Motor tidak ditemukan.' });
    if (motorRows[0].status === 'Terjual') {
      return res.status(400).json({ success: false, message: 'Motor yang sudah terjual tidak dapat digunakan untuk test drive.' });
    }

    // Validasi jadwal bentrok
    const conflict = await hasScheduleConflict(salesId, booking_date, booking_time);
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Jadwal test drive bentrok dengan booking lain pada sales yang sama.' });
    }

    // Generate booking code unik: TD-YYYY-XXX
    const year = new Date(booking_date).getFullYear();
    const [countRows] = await pool.query(
      'SELECT COUNT(*) as total FROM test_drive_bookings WHERE booking_code LIKE ?',
      [`TD-${year}-%`]
    );
    let sequence = countRows[0].total + 1;
    let bookingCode = generateBookingCode(sequence, year);
    // pastikan benar-benar unik walau ada race condition sederhana
    let unique = false;
    while (!unique) {
      const [dupe] = await pool.query('SELECT id FROM test_drive_bookings WHERE booking_code = ?', [bookingCode]);
      if (dupe.length === 0) unique = true;
      else { sequence++; bookingCode = generateBookingCode(sequence, year); }
    }

    const [result] = await pool.query(
      `INSERT INTO test_drive_bookings (booking_code, customer_id, motorcycle_id, sales_id, booking_date, booking_time, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu')`,
      [bookingCode, customer_id, motorcycle_id, salesId, booking_date, booking_time, notes || null]
    );

    await pool.query("UPDATE motorcycles SET status = 'Dibooking' WHERE id = ?", [motorcycle_id]);

    res.status(201).json({ success: true, message: 'Booking berhasil dibuat.', data: { id: result.insertId, booking_code: bookingCode } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bookings/:id
async function updateBooking(req, res, next) {
  try {
    const { id } = req.params;
    const [existingRows] = await pool.query('SELECT * FROM test_drive_bookings WHERE id = ?', [id]);
    if (!existingRows[0]) return res.status(404).json({ success: false, message: 'Booking tidak ditemukan.' });
    if (req.user.role === 'sales' && existingRows[0].sales_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke booking ini.' });
    }

    const { booking_date, booking_time, notes, motorcycle_id } = req.body;

    if (booking_date && booking_time) {
      const conflict = await hasScheduleConflict(existingRows[0].sales_id, booking_date, booking_time, id);
      if (conflict) {
        return res.status(409).json({ success: false, message: 'Jadwal test drive bentrok dengan booking lain.' });
      }
    }

    const fields = [];
    const values = [];
    if (booking_date) { fields.push('booking_date = ?'); values.push(booking_date); }
    if (booking_time) { fields.push('booking_time = ?'); values.push(booking_time); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
    if (motorcycle_id) { fields.push('motorcycle_id = ?'); values.push(motorcycle_id); }
    if (fields.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });

    values.push(id);
    await pool.query(`UPDATE test_drive_bookings SET ${fields.join(', ')} WHERE id = ?`, values);
    res.json({ success: true, message: 'Booking berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bookings/:id/status - ubah status booking
async function updateBookingStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['Menunggu', 'Dikonfirmasi', 'Selesai', 'Dibatalkan'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    }

    const [rows] = await pool.query('SELECT * FROM test_drive_bookings WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Booking tidak ditemukan.' });
    if (req.user.role === 'sales' && rows[0].sales_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke booking ini.' });
    }

    await pool.query('UPDATE test_drive_bookings SET status = ? WHERE id = ?', [status, id]);

    // Sinkronisasi status motor berdasarkan status booking
    if (status === 'Selesai') {
      await pool.query("UPDATE motorcycles SET status = 'Test Drive' WHERE id = ?", [rows[0].motorcycle_id]);
    } else if (status === 'Dibatalkan') {
      await pool.query("UPDATE motorcycles SET status = 'Tersedia' WHERE id = ?", [rows[0].motorcycle_id]);
    } else if (status === 'Dikonfirmasi') {
      await pool.query("UPDATE motorcycles SET status = 'Dibooking' WHERE id = ?", [rows[0].motorcycle_id]);
    }

    res.json({ success: true, message: 'Status booking berhasil diperbarui.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/bookings/:id/cancel
async function cancelBooking(req, res, next) {
  req.body.status = 'Dibatalkan';
  return updateBookingStatus(req, res, next);
}

module.exports = {
  getBookings,
  getCalendar,
  getBookingById,
  createBooking,
  updateBooking,
  updateBookingStatus,
  cancelBooking,
};
