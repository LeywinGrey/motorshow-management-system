const pool = require('../config/db');
const { isValidRating } = require('../utils/validators');

// GET /api/public/satisfaction/verify/:bookingCode
// Endpoint publik (tanpa login) untuk validasi kode booking sebelum menampilkan form
async function verifyBookingCode(req, res, next) {
  try {
    const { bookingCode } = req.params;
    const [rows] = await pool.query(
      `SELECT b.id as booking_id, b.booking_code, b.booking_date, b.status,
              c.id as customer_id, c.name as customer_name,
              m.brand as motor_brand, m.model as motor_model,
              u.name as sales_name
       FROM test_drive_bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN motorcycles m ON b.motorcycle_id = m.id
       JOIN users u ON b.sales_id = u.id
       WHERE b.booking_code = ?`,
      [bookingCode]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Kode booking tidak ditemukan. Periksa kembali kode Anda.' });
    }
    const booking = rows[0];

    if (booking.status !== 'Selesai') {
      return res.status(400).json({ success: false, message: 'Test drive untuk booking ini belum selesai, penilaian belum dapat diisi.' });
    }

    const [existingReview] = await pool.query(
      'SELECT id FROM customer_satisfaction WHERE booking_id = ?',
      [booking.booking_id]
    );
    if (existingReview.length > 0) {
      return res.status(400).json({ success: false, message: 'Booking ini sudah pernah diberikan penilaian. Terima kasih.' });
    }

    res.json({
      success: true,
      data: {
        booking_id: booking.booking_id,
        booking_code: booking.booking_code,
        customer_name: booking.customer_name,
        motor: `${booking.motor_brand} ${booking.motor_model}`,
        booking_date: booking.booking_date,
        sales_name: booking.sales_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/public/satisfaction/submit
// Endpoint publik untuk mengirim penilaian kepuasan
async function submitSatisfaction(req, res, next) {
  try {
    const { booking_code, overall_rating, sales_rating, booking_rating, test_drive_rating, comment } = req.body;

    if (!booking_code) return res.status(400).json({ success: false, message: 'Kode booking wajib diisi.' });
    const ratings = [overall_rating, sales_rating, booking_rating, test_drive_rating];
    if (ratings.some((r) => !isValidRating(r))) {
      return res.status(400).json({ success: false, message: 'Semua rating harus bernilai 1 sampai 5.' });
    }

    const [bookingRows] = await pool.query(
      'SELECT * FROM test_drive_bookings WHERE booking_code = ?',
      [booking_code]
    );
    if (!bookingRows[0]) return res.status(404).json({ success: false, message: 'Kode booking tidak ditemukan.' });
    const booking = bookingRows[0];

    if (booking.status !== 'Selesai') {
      return res.status(400).json({ success: false, message: 'Test drive belum selesai, penilaian belum dapat dikirim.' });
    }

    const [existingReview] = await pool.query('SELECT id FROM customer_satisfaction WHERE booking_id = ?', [booking.id]);
    if (existingReview.length > 0) {
      return res.status(400).json({ success: false, message: 'Booking ini sudah pernah diberikan penilaian.' });
    }

    await pool.query(
      `INSERT INTO customer_satisfaction
        (booking_id, customer_id, sales_id, overall_rating, sales_rating, booking_rating, test_drive_rating, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [booking.id, booking.customer_id, booking.sales_id, overall_rating, sales_rating, booking_rating, test_drive_rating, comment || null]
    );

    res.status(201).json({ success: true, message: 'Terima kasih atas penilaian Anda.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/satisfaction - untuk Admin/Sales melihat hasil penilaian (internal, butuh login)
async function getSatisfactionList(req, res, next) {
  try {
    const { sales_id, page = 1, limit = 15 } = req.query;
    const conditions = [];
    const values = [];

    if (req.user.role === 'sales') {
      conditions.push('s.sales_id = ?');
      values.push(req.user.id);
    } else if (sales_id) {
      conditions.push('s.sales_id = ?');
      values.push(sales_id);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(
      `SELECT s.*, c.name as customer_name, u.name as sales_name, b.booking_code
       FROM customer_satisfaction s
       JOIN customers c ON s.customer_id = c.id
       JOIN users u ON s.sales_id = u.id
       JOIN test_drive_bookings b ON s.booking_id = b.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, Number(limit), offset]
    );
    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM customer_satisfaction s ${whereClause}`, values);

    res.json({
      success: true,
      data: rows,
      pagination: { page: Number(page), limit: Number(limit), total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyBookingCode, submitSatisfaction, getSatisfactionList };
