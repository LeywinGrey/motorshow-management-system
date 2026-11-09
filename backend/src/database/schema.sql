-- MotorShow Management System - Database Schema
-- Jalankan file ini di MySQL untuk membuat database & tabel

CREATE DATABASE IF NOT EXISTS motorshow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE motorshow_db;

-- =========================
-- TABLE: users (Admin & Sales)
-- =========================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'sales') NOT NULL DEFAULT 'sales',
  phone VARCHAR(20) DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =========================
-- TABLE: motorcycles
-- =========================
CREATE TABLE IF NOT EXISTS motorcycles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  brand VARCHAR(50) NOT NULL DEFAULT 'Honda',
  model VARCHAR(100) NOT NULL,                 -- Excel: "Nama Tipe Motor"
  year INT NOT NULL,                           -- Excel: "Tahun"
  color VARCHAR(50) NOT NULL,                  -- Excel: "Warna"
  price DECIMAL(15,2) DEFAULT NULL,            -- tidak ada di Excel stok, opsional
  image VARCHAR(255) DEFAULT NULL,
  status ENUM('Tersedia','Dibooking','Test Drive','Terjual') NOT NULL DEFAULT 'Tersedia',
  -- Kolom hasil refactor Inventory (mengikuti template STOK UNIT MM.xlsx)
  channel VARCHAR(100) DEFAULT NULL,           -- Excel: "Channel"
  channel_no INT DEFAULT NULL,                 -- Excel: "No." (urutan per channel, BUKAN primary key)
  type_code VARCHAR(30) DEFAULT NULL,          -- Excel: "Tipe Motor" (mis. H1B2N2A5)
  color_code VARCHAR(20) DEFAULT NULL,         -- Excel: "Kode Warna"
  engine_number VARCHAR(40) DEFAULT NULL,      -- Excel: "Nomor Mesin"
  chassis_number VARCHAR(40) DEFAULT NULL,     -- Excel: "Nomor Rangka"
  purchase_date DATE DEFAULT NULL,             -- Excel: "Tanggal Beli"
  display_date DATE DEFAULT NULL,              -- Excel: "Tanggal Display"
  friction VARCHAR(100) DEFAULT NULL,          -- Excel: "Gesekan" (boleh kosong)
  supplier VARCHAR(100) DEFAULT NULL,          -- Excel: "Supplier"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_motorcycles_engine (engine_number),
  UNIQUE KEY uq_motorcycles_chassis (chassis_number),
  INDEX idx_motorcycles_channel (channel, channel_no),
  INDEX idx_motorcycles_type_code (type_code),
  INDEX idx_motorcycles_supplier (supplier)
) ENGINE=InnoDB;

-- =========================
-- TABLE: customers
-- =========================
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  interested_motorcycle_id INT DEFAULT NULL,
  assigned_sales_id INT DEFAULT NULL,
  status ENUM('Lead','Prospek','Test Drive','Follow Up','Negosiasi','Booking','Terjual','Tidak Jadi') NOT NULL DEFAULT 'Lead',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_motorcycle FOREIGN KEY (interested_motorcycle_id) REFERENCES motorcycles(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_sales FOREIGN KEY (assigned_sales_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =========================
-- TABLE: test_drive_bookings
-- =========================
CREATE TABLE IF NOT EXISTS test_drive_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_code VARCHAR(30) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  motorcycle_id INT NOT NULL,
  sales_id INT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  notes TEXT DEFAULT NULL,
  status ENUM('Menunggu','Dikonfirmasi','Selesai','Dibatalkan') NOT NULL DEFAULT 'Menunggu',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_motorcycle FOREIGN KEY (motorcycle_id) REFERENCES motorcycles(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_sales FOREIGN KEY (sales_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- TABLE: crm_activities
-- =========================
CREATE TABLE IF NOT EXISTS crm_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  sales_id INT NOT NULL,
  activity_type ENUM('Telepon','WhatsApp','Bertemu Langsung','Test Drive','Follow Up','Negosiasi') NOT NULL,
  activity_date DATETIME NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_crm_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_crm_sales FOREIGN KEY (sales_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================
-- TABLE: customer_satisfaction
-- =========================
CREATE TABLE IF NOT EXISTS customer_satisfaction (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  sales_id INT NOT NULL,
  overall_rating TINYINT NOT NULL,
  sales_rating TINYINT NOT NULL,
  booking_rating TINYINT NOT NULL,
  test_drive_rating TINYINT NOT NULL,
  comment TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_satisfaction_booking FOREIGN KEY (booking_id) REFERENCES test_drive_bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_satisfaction_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_satisfaction_sales FOREIGN KEY (sales_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_ratings CHECK (
    overall_rating BETWEEN 1 AND 5 AND sales_rating BETWEEN 1 AND 5 AND
    booking_rating BETWEEN 1 AND 5 AND test_drive_rating BETWEEN 1 AND 5
  )
) ENGINE=InnoDB;

CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_motorcycles_status ON motorcycles(status);
CREATE INDEX idx_booking_date ON test_drive_bookings(booking_date);
CREATE INDEX idx_crm_customer ON crm_activities(customer_id);
