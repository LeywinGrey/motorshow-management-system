const pool = require('../config/db');

function buildDateFilter(startDate, endDate, column) {
  const conditions = [];
  const values = [];
  if (startDate) { conditions.push(`${column} >= ?`); values.push(startDate); }
  if (endDate) { conditions.push(`${column} <= ?`); values.push(endDate); }
  return { conditions, values };
}

// GET /api/reports/inventory
async function inventoryReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as total_motor, SUM(status='Tersedia') as tersedia, SUM(status='Dibooking') as dibooking,
              SUM(status='Test Drive') as test_drive, SUM(status='Terjual') as terjual
       FROM motorcycles`
    );
    const [byBrand] = await pool.query('SELECT brand, COUNT(*) as total FROM motorcycles GROUP BY brand ORDER BY total DESC');
    res.json({ success: true, data: { summary: rows[0], by_brand: byBrand } });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/sales
async function salesReport(req, res, next) {
  try {
    const { start_date, end_date } = req.query;
    const { conditions, values } = buildDateFilter(start_date, end_date, 'c.created_at');
    const whereClause = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT u.id as sales_id, u.name as sales_name,
              COUNT(DISTINCT c.id) as jumlah_pelanggan,
              SUM(c.status = 'Terjual') as jumlah_terjual,
              (SELECT COUNT(*) FROM test_drive_bookings b WHERE b.sales_id = u.id) as jumlah_booking,
              (SELECT COUNT(*) FROM test_drive_bookings b WHERE b.sales_id = u.id AND b.status = 'Selesai') as jumlah_test_drive
       FROM users u
       LEFT JOIN customers c ON c.assigned_sales_id = u.id ${whereClause}
       WHERE u.role = 'sales'
       GROUP BY u.id, u.name`,
      values
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/test-drive
async function testDriveReport(req, res, next) {
  try {
    const { start_date, end_date, sales_id } = req.query;
    const conditions = [];
    const values = [];
    if (start_date) { conditions.push('booking_date >= ?'); values.push(start_date); }
    if (end_date) { conditions.push('booking_date <= ?'); values.push(end_date); }
    if (sales_id) { conditions.push('sales_id = ?'); values.push(sales_id); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [summary] = await pool.query(
      `SELECT COUNT(*) as total, SUM(status='Selesai') as selesai, SUM(status='Dibatalkan') as dibatalkan,
              SUM(status='Menunggu') as menunggu, SUM(status='Dikonfirmasi') as dikonfirmasi
       FROM test_drive_bookings ${whereClause}`,
      values
    );
    const [schedule] = await pool.query(
      `SELECT b.booking_code, b.booking_date, b.booking_time, b.status, c.name as customer_name, u.name as sales_name
       FROM test_drive_bookings b JOIN customers c ON b.customer_id = c.id JOIN users u ON b.sales_id = u.id
       ${whereClause} ORDER BY b.booking_date DESC LIMIT 50`,
      values
    );
    res.json({ success: true, data: { summary: summary[0], schedule } });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/satisfaction
async function satisfactionReport(req, res, next) {
  try {
    const { start_date, end_date, sales_id } = req.query;
    const conditions = [];
    const values = [];
    if (start_date) { conditions.push('s.created_at >= ?'); values.push(start_date); }
    if (end_date) { conditions.push('s.created_at <= ?'); values.push(end_date); }
    if (sales_id) { conditions.push('s.sales_id = ?'); values.push(sales_id); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [summary] = await pool.query(
      `SELECT AVG(overall_rating) as avg_overall, AVG(sales_rating) as avg_sales,
              AVG(booking_rating) as avg_booking, AVG(test_drive_rating) as avg_test_drive,
              COUNT(*) as total_review
       FROM customer_satisfaction s ${whereClause}`,
      values
    );
    const commentCondition = conditions.length
      ? `WHERE ${conditions.join(' AND ')} AND s.comment IS NOT NULL AND s.comment != ''`
      : `WHERE s.comment IS NOT NULL AND s.comment != ''`;
    const [comments] = await pool.query(
      `SELECT s.comment, s.overall_rating, s.created_at, c.name as customer_name, u.name as sales_name
       FROM customer_satisfaction s JOIN customers c ON s.customer_id = c.id JOIN users u ON s.sales_id = u.id
       ${commentCondition}
       ORDER BY s.created_at DESC LIMIT 50`,
      values
    );
    res.json({ success: true, data: { summary: summary[0], comments } });
  } catch (err) {
    next(err);
  }
}

module.exports = { inventoryReport, salesReport, testDriveReport, satisfactionReport };
