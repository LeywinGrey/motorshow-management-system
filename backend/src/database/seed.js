/**
 * Seed data dummy untuk pengujian aplikasi.
 * Jalankan dengan: npm run seed
 * (Pastikan migration/schema sudah dijalankan terlebih dahulu)
 */
const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('../config/db');
const generateBookingCode = require('../utils/generateBookingCode');

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('Menghapus data lama...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE customer_satisfaction');
    await conn.query('TRUNCATE TABLE crm_activities');
    await conn.query('TRUNCATE TABLE test_drive_bookings');
    await conn.query('TRUNCATE TABLE customers');
    await conn.query('TRUNCATE TABLE motorcycles');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Membuat users (1 admin, 3 sales)...');
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = [
      ['Andi Wijaya', 'admin@motorshow.com', passwordHash, 'admin', '081234567890'],
      ['Budi Santoso', 'budi.sales@motorshow.com', passwordHash, 'sales', '081298765432'],
      ['Citra Ayu Lestari', 'citra.sales@motorshow.com', passwordHash, 'sales', '081345678901'],
      ['Dedi Kurniawan', 'dedi.sales@motorshow.com', passwordHash, 'sales', '081456789012'],
    ];
    const userIds = [];
    for (const u of users) {
      const [res] = await conn.query(
        'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
        u
      );
      userIds.push(res.insertId);
    }
    const [adminId, salesId1, salesId2, salesId3] = userIds;
    const salesIds = [salesId1, salesId2, salesId3];

    console.log('Membuat 15 data motor...');
    const motorcycles = [
      ['Honda', 'Vario 160', 2024, 'Merah', 28500000, 'Tersedia'],
      ['Honda', 'PCX 160', 2024, 'Hitam', 33500000, 'Tersedia'],
      ['Honda', 'Beat Street', 2023, 'Putih', 19500000, 'Terjual'],
      ['Honda', 'CBR 150R', 2024, 'Merah', 41500000, 'Test Drive'],
      ['Honda', 'ADV 160', 2024, 'Hijau', 37500000, 'Tersedia'],
      ['Yamaha', 'NMAX 155', 2024, 'Hitam', 34500000, 'Dibooking'],
      ['Yamaha', 'Aerox 155', 2024, 'Biru', 30500000, 'Tersedia'],
      ['Yamaha', 'Lexi LX 155', 2023, 'Putih', 27000000, 'Tersedia'],
      ['Yamaha', 'XSR 155', 2024, 'Coklat', 39500000, 'Test Drive'],
      ['Yamaha', 'Fazzio', 2023, 'Krem', 22500000, 'Terjual'],
      ['Suzuki', 'Nex II', 2023, 'Merah', 18500000, 'Tersedia'],
      ['Suzuki', 'GSX-R150', 2024, 'Biru', 38500000, 'Tersedia'],
      ['Kawasaki', 'W175', 2023, 'Hitam', 32000000, 'Tersedia'],
      ['Kawasaki', 'Ninja 250', 2024, 'Hijau', 68500000, 'Dibooking'],
      ['Vespa', 'Sprint 150', 2023, 'Kuning', 55000000, 'Tersedia'],
    ];
    const motorIds = [];
    for (const m of motorcycles) {
      const [res] = await conn.query(
        'INSERT INTO motorcycles (brand, model, year, color, price, status) VALUES (?, ?, ?, ?, ?, ?)',
        m
      );
      motorIds.push(res.insertId);
    }

    console.log('Membuat 10 data pelanggan...');
    const customerNames = [
      ['Rian Hidayat', '081511122233', 'rian.hidayat@gmail.com', 'Jl. Sudirman No. 12, Jakarta Selatan'],
      ['Siti Nurhaliza', '081522233344', 'siti.nur@gmail.com', 'Jl. Gatot Subroto No. 45, Jakarta'],
      ['Agus Setiawan', '081533344455', 'agus.setiawan@gmail.com', 'Jl. Diponegoro No. 8, Bandung'],
      ['Dewi Puspitasari', '081544455566', 'dewi.puspita@gmail.com', 'Jl. Ahmad Yani No. 21, Surabaya'],
      ['Fajar Ramadhan', '081555566677', 'fajar.ramadhan@gmail.com', 'Jl. Merdeka No. 3, Bekasi'],
      ['Lina Marlina', '081566677788', 'lina.marlina@gmail.com', 'Jl. Kartini No. 17, Tangerang'],
      ['Yusuf Maulana', '081577788899', 'yusuf.maulana@gmail.com', 'Jl. Pahlawan No. 9, Depok'],
      ['Rina Wulandari', '081588899900', 'rina.wulandari@gmail.com', 'Jl. Veteran No. 5, Bogor'],
      ['Hendra Gunawan', '081599900011', 'hendra.gunawan@gmail.com', 'Jl. Cendrawasih No. 14, Jakarta Timur'],
      ['Putri Ayu Ningsih', '081611122233', 'putri.ayu@gmail.com', 'Jl. Melati No. 6, Jakarta Barat'],
    ];
    const statuses = ['Lead', 'Prospek', 'Test Drive', 'Follow Up', 'Negosiasi', 'Booking', 'Terjual', 'Tidak Jadi'];
    const customerIds = [];
    for (let i = 0; i < customerNames.length; i++) {
      const [name, phone, email, address] = customerNames[i];
      const sales = salesIds[i % salesIds.length];
      const motor = motorIds[i % motorIds.length];
      const status = statuses[i % statuses.length];
      const [res] = await conn.query(
        `INSERT INTO customers (name, phone, email, address, interested_motorcycle_id, assigned_sales_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, phone, email, address, motor, sales, status]
      );
      customerIds.push(res.insertId);
    }

    console.log('Membuat 15+ aktivitas CRM...');
    const activityTypes = ['Telepon', 'WhatsApp', 'Bertemu Langsung', 'Test Drive', 'Follow Up', 'Negosiasi'];
    const activityNotes = [
      'Menghubungi pelanggan untuk menawarkan unit terbaru.',
      'Pelanggan tertarik namun masih mempertimbangkan budget.',
      'Bertemu langsung di showroom untuk melihat unit.',
      'Follow up terkait keputusan pembelian.',
      'Negosiasi harga dan skema pembayaran.',
      'Mengonfirmasi jadwal test drive.',
    ];
    let activityCount = 0;
    for (let i = 0; i < customerIds.length; i++) {
      const numActivities = 1 + (i % 2); // 1-2 aktivitas per pelanggan agar total 15+
      for (let j = 0; j < numActivities + 1; j++) {
        const type = activityTypes[(i + j) % activityTypes.length];
        const note = activityNotes[(i + j) % activityNotes.length];
        const sales = salesIds[i % salesIds.length];
        const daysAgo = (i + j) * 2;
        await conn.query(
          `INSERT INTO crm_activities (customer_id, sales_id, activity_type, activity_date, notes)
           VALUES (?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), ?)`,
          [customerIds[i], sales, type, daysAgo, note]
        );
        activityCount++;
      }
    }
    console.log(`  -> ${activityCount} aktivitas CRM dibuat.`);

    console.log('Membuat 10 booking test drive...');
    const bookingStatuses = ['Menunggu', 'Dikonfirmasi', 'Selesai', 'Selesai', 'Selesai', 'Dibatalkan'];
    const bookingIds = [];
    for (let i = 0; i < 10; i++) {
      const customer = customerIds[i % customerIds.length];
      const motor = motorIds[i % motorIds.length];
      const sales = salesIds[i % salesIds.length];
      const status = bookingStatuses[i % bookingStatuses.length];
      const bookingCode = generateBookingCode(i + 1, 2026);
      const dayOffset = i - 5; // campuran tanggal lampau & mendatang
      const hour = 9 + (i % 6);
      const [res] = await conn.query(
        `INSERT INTO test_drive_bookings
          (booking_code, customer_id, motorcycle_id, sales_id, booking_date, booking_time, notes, status)
         VALUES (?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, ?)`,
        [bookingCode, customer, motor, sales, dayOffset, `${String(hour).padStart(2,'0')}:00:00`, 'Test drive sesuai permintaan pelanggan.', status]
      );
      bookingIds.push({ id: res.insertId, status, customer, sales });
    }

    console.log('Membuat beberapa penilaian kepuasan untuk booking Selesai...');
    const completedBookings = bookingIds.filter((b) => b.status === 'Selesai');
    let satCount = 0;
    for (let i = 0; i < completedBookings.length; i++) {
      if (i % 2 === 0) continue; // hanya sebagian booking selesai yang sudah dinilai
      const b = completedBookings[i];
      const rnd = () => 3 + Math.floor(Math.random() * 3); // rating 3-5
      await conn.query(
        `INSERT INTO customer_satisfaction
          (booking_id, customer_id, sales_id, overall_rating, sales_rating, booking_rating, test_drive_rating, comment)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.customer, b.sales, rnd(), rnd(), rnd(), rnd(), 'Pelayanan sangat memuaskan, sales ramah dan informatif.']
      );
      satCount++;
    }
    console.log(`  -> ${satCount} penilaian kepuasan dibuat.`);

    console.log('✅ Seeding selesai!');
    console.log('----------------------------------------');
    console.log('Akun Admin  : admin@motorshow.com / password123');
    console.log('Akun Sales  : budi.sales@motorshow.com / password123');
    console.log('----------------------------------------');
  } catch (err) {
    console.error('❌ Seeding gagal:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
