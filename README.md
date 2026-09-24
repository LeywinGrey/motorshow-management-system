# MotorShow Management System

Aplikasi web lokal untuk kebutuhan Kerja Praktik (KP): manajemen inventory motor, sales CRM, booking test drive, dan penilaian kepuasan pelanggan untuk showroom motor.

Dibangun mengikuti seluruh spesifikasi dari dokumen requirement: 3 aktor (Admin, Sales, Pelanggan tanpa login), 6 modul utama, dashboard Admin & Sales, laporan, autentikasi JWT + bcrypt, dan database MySQL dengan relasi foreign key.

## Struktur Project

```
motorshow-management-system/
├── backend/     → Node.js + Express + MySQL (REST API)
└── frontend/    → React + Vite + Tailwind CSS
```

## Teknologi

- **Frontend:** React, Tailwind CSS, Lucide Icons, Recharts, React Router, Axios
  (Catatan: shadcn/ui tidak disertakan secara literal karena membutuhkan CLI interaktif;
  komponen UI dibangun manual dengan Tailwind agar mudah dijalankan dan dikembangkan mahasiswa.
  Anda tetap bisa menambahkan shadcn/ui belakangan dengan `npx shadcn@latest init`.)
- **Backend:** Node.js, Express.js, JWT, bcryptjs, Multer (upload foto)
- **Database:** MySQL

## Prasyarat

- Node.js v18+ dan npm
- MySQL Server (bisa via XAMPP/Laragon/MySQL langsung) sudah berjalan di `localhost:3306`

## 1. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit file `.env` sesuaikan dengan kredensial MySQL Anda:

```
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=motorshow_db
JWT_SECRET=ganti_dengan_secret_key_yang_kuat
JWT_EXPIRES_IN=8h
CLIENT_URL=http://localhost:5173
```

Jalankan migration (membuat database & tabel otomatis):

```bash
npm run migrate
```

Jalankan seed data dummy (1 admin, 3 sales, 15 motor, 10 pelanggan, 15+ aktivitas CRM, 10 booking, beberapa penilaian):

```bash
npm run seed
```

Jalankan server backend:

```bash
npm run dev
# atau: npm start
```

Backend akan berjalan di `http://localhost:5000`. Cek `http://localhost:5000/api/health` untuk memastikan API aktif.

### Akun default hasil seeding

| Role  | Email                      | Password    |
|-------|-----------------------------|-------------|
| Admin | admin@motorshow.com         | password123 |
| Sales | budi.sales@motorshow.com    | password123 |
| Sales | citra.sales@motorshow.com   | password123 |
| Sales | dedi.sales@motorshow.com    | password123 |

## 2. Setup Frontend

Buka terminal baru:

```bash
cd frontend
npm install
npm run dev
```

Frontend akan berjalan di `http://localhost:5173` dan otomatis proxy request `/api` dan `/uploads` ke backend `http://localhost:5000` (lihat `vite.config.js`).

## 3. Mengakses Aplikasi

- **Login Admin/Sales:** `http://localhost:5173/login`
- **Halaman Penilaian Kepuasan Pelanggan (tanpa login):** `http://localhost:5173/penilaian`
  - Gunakan salah satu kode booking dari data seed dengan status "Selesai", contoh: `TD-2026-003` (kode dibuat berurutan saat seeding — cek isi tabel `test_drive_bookings` untuk kode & status pasti pada instance Anda).

## Modul yang Sudah Diimplementasikan

1. **Autentikasi** – JWT, bcrypt, role-based authorization (Admin & Sales), protected routes.
2. **Inventory Management** – CRUD motor, upload foto, search, filter (merek/tipe/tahun/status), sorting harga, ringkasan status.
3. **Data Pelanggan** – CRUD, search, filter status, assign ke sales, sales hanya melihat data miliknya.
4. **Sales CRM** – Timeline aktivitas (Telepon, WhatsApp, Bertemu Langsung, Test Drive, Follow Up, Negosiasi), tambah/edit/hapus/filter aktivitas.
5. **Booking Test Drive** – CRUD booking, validasi jadwal bentrok, kalender bulanan, filter tanggal/sales/status, kode booking unik `TD-YYYY-XXX`.
6. **Kepuasan Pelanggan** – Halaman publik tanpa login, validasi kode booking (harus status Selesai & belum pernah dinilai), form rating bintang 1–5 x4 kategori + komentar, halaman terima kasih.
7. **Dashboard Admin** – Statistik lengkap, grafik (booking per bulan, status pelanggan, aktivitas CRM, distribusi rating), aktivitas terbaru.
8. **Dashboard Sales** – Statistik khusus sales yang login, jadwal test drive terdekat, pelanggan terbaru, aktivitas CRM.
9. **Laporan** – Inventory, Sales, Test Drive, Kepuasan; filter tanggal; export CSV (bisa dibuka di Excel).
10. **Manajemen Pengguna** – CRUD akun Admin/Sales (Admin only).
11. **Validasi** – Email, nomor HP Indonesia, tahun motor, harga, jadwal bentrok, kode booking unik, satu booking satu penilaian, motor terjual tidak bisa test drive, akses data sales dibatasi ke miliknya sendiri.

## Catatan Pengembangan Lanjutan (untuk laporan KP)

Struktur backend sudah dipisah per lapisan (`controllers`, `routes`, `middleware`, `utils`, `database`) dan frontend per (`pages`, `components`, `context`, `services`) agar mudah dikembangkan bertahap sesuai 12 tahapan pada dokumen requirement (Tahap 1–12). Beberapa hal yang bisa ditambahkan sebagai pengembangan lanjutan:

- Export laporan ke PDF (saat ini tersedia export CSV/Excel-compatible).
- Integrasi library kalender yang lebih kaya (mis. FullCalendar) menggantikan kalender sederhana bawaan.
- Notifikasi real-time (WebSocket) untuk booking baru.
- Halaman detail motor terpisah dan galeri foto multi-gambar.

## Troubleshooting

- **Error koneksi database:** pastikan MySQL sudah berjalan dan kredensial di `.env` benar.
- **CORS error:** pastikan `CLIENT_URL` di `.env` backend sesuai dengan URL frontend yang dipakai.
- **Foto motor tidak muncul:** pastikan folder `backend/uploads/motorcycles` ada dan backend berjalan (foto disajikan lewat `/uploads/...`).
