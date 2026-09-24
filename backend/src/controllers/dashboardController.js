const pool = require('../config/db');

// GET /api/dashboard/admin
async function getAdminDashboard(req, res, next) {
  try {
    const [motorStats] = await pool.query(
      `SELECT COUNT(*) as total, SUM(status='Tersedia') as tersedia, SUM(status='Dibooking') as dibooking,
              SUM(status='Test Drive') as test_drive, SUM(status='Terjual') as terjual
       FROM motorcycles`
    );
    const [customerCount] = await pool.query('SELECT COUNT(*) as total FROM customers');
    const [salesCount] = await pool.query("SELECT COUNT(*) as total FROM users WHERE role = 'sales'");
    const [bookingCount] = await pool.query('SELECT COUNT(*) as total FROM test_drive_bookings');
    const [completedBookingCount] = await pool.query("SELECT COUNT(*) as total FROM test_drive_bookings WHERE status = 'Selesai'");
    const [avgRating] = await pool.query('SELECT AVG(overall_rating) as avg_rating FROM customer_satisfaction');

    const [bookingByMonth] = await pool.query(
      `SELECT DATE_FORMAT(booking_date, '%Y-%m') as month, COUNT(*) as total
       FROM test_drive_bookings
       WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month`
    );
    const [customerByStatus] = await pool.query('SELECT status, COUNT(*) as total FROM customers GROUP BY status');
    const [activityByType] = await pool.query('SELECT activity_type, COUNT(*) as total FROM crm_activities GROUP BY activity_type');
    const [ratingDistribution] = await pool.query('SELECT overall_rating as rating, COUNT(*) as total FROM customer_satisfaction GROUP BY overall_rating ORDER BY overall_rating');

    const [recentBookings] = await pool.query(
      `SELECT b.booking_code, b.status, b.created_at, c.name as customer_name, m.brand, m.model
       FROM test_drive_bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN motorcycles m ON b.motorcycle_id = m.id
       ORDER BY b.created_at DESC LIMIT 5`
    );
    const [recentCustomers] = await pool.query(
      `SELECT c.name, c.status, c.created_at, u.name as sales_name
       FROM customers c LEFT JOIN users u ON c.assigned_sales_id = u.id
       ORDER BY c.created_at DESC LIMIT 5`
    );
    const [recentActivities] = await pool.query(
      `SELECT ca.activity_type, ca.activity_date, c.name as customer_name, u.name as sales_name
       FROM crm_activities ca
       JOIN customers c ON ca.customer_id = c.id
       JOIN users u ON ca.sales_id = u.id
       ORDER BY ca.created_at DESC LIMIT 5`
    );
    const [recentReviews] = await pool.query(
      `SELECT s.overall_rating, s.comment, s.created_at, c.name as customer_name
       FROM customer_satisfaction s JOIN customers c ON s.customer_id = c.id
       ORDER BY s.created_at DESC LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        stats: {
          total_motor: motorStats[0].total,
          motor_tersedia: motorStats[0].tersedia,
          motor_dibooking: motorStats[0].dibooking,
          motor_test_drive: motorStats[0].test_drive,
          motor_terjual: motorStats[0].terjual,
          total_pelanggan: customerCount[0].total,
          total_sales: salesCount[0].total,
          total_booking: bookingCount[0].total,
          test_drive_selesai: completedBookingCount[0].total,
          rata_rata_kepuasan: avgRating[0].avg_rating ? Number(avgRating[0].avg_rating).toFixed(2) : null,
        },
        charts: { bookingByMonth, customerByStatus, activityByType, ratingDistribution },
        recent: { bookings: recentBookings, customers: recentCustomers, activities: recentActivities, reviews: recentReviews },
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/dashboard/sales
async function getSalesDashboard(req, res, next) {
  try {
    const salesId = req.user.id;

    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) as total FROM customers WHERE assigned_sales_id = ? GROUP BY status`,
      [salesId]
    );
    const statusMap = {};
    statusCounts.forEach((s) => { statusMap[s.status] = s.total; });

    const [totalCustomers] = await pool.query('SELECT COUNT(*) as total FROM customers WHERE assigned_sales_id = ?', [salesId]);
    const [todayBookings] = await pool.query(
      `SELECT COUNT(*) as total FROM test_drive_bookings WHERE sales_id = ? AND booking_date = CURDATE()`,
      [salesId]
    );
    const [avgRating] = await pool.query('SELECT AVG(overall_rating) as avg_rating FROM customer_satisfaction WHERE sales_id = ?', [salesId]);
    const [followUpNeeded] = await pool.query(
      `SELECT COUNT(*) as total FROM customers WHERE assigned_sales_id = ? AND status IN ('Follow Up','Prospek','Negosiasi')`,
      [salesId]
    );

    const [upcomingSchedule] = await pool.query(
      `SELECT b.booking_code, b.booking_date, b.booking_time, b.status, c.name as customer_name, m.brand, m.model
       FROM test_drive_bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN motorcycles m ON b.motorcycle_id = m.id
       WHERE b.sales_id = ? AND b.booking_date >= CURDATE() AND b.status IN ('Menunggu','Dikonfirmasi')
       ORDER BY b.booking_date, b.booking_time LIMIT 5`,
      [salesId]
    );
    const [recentCustomers] = await pool.query(
      `SELECT name, status, created_at FROM customers WHERE assigned_sales_id = ? ORDER BY created_at DESC LIMIT 5`,
      [salesId]
    );
    const [recentActivities] = await pool.query(
      `SELECT ca.activity_type, ca.activity_date, c.name as customer_name
       FROM crm_activities ca JOIN customers c ON ca.customer_id = c.id
       WHERE ca.sales_id = ? ORDER BY ca.created_at DESC LIMIT 5`,
      [salesId]
    );

    res.json({
      success: true,
      data: {
        stats: {
          total_pelanggan: totalCustomers[0].total,
          lead: statusMap['Lead'] || 0,
          prospek: statusMap['Prospek'] || 0,
          test_drive: statusMap['Test Drive'] || 0,
          follow_up: statusMap['Follow Up'] || 0,
          booking: statusMap['Booking'] || 0,
          terjual: statusMap['Terjual'] || 0,
          booking_hari_ini: todayBookings[0].total,
          perlu_follow_up: followUpNeeded[0].total,
          rata_rata_kepuasan: avgRating[0].avg_rating ? Number(avgRating[0].avg_rating).toFixed(2) : null,
        },
        upcoming_schedule: upcomingSchedule,
        recent_customers: recentCustomers,
        recent_activities: recentActivities,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAdminDashboard, getSalesDashboard };
