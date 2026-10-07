const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const motorcycleRoutes = require('./routes/motorcycleRoutes');
const customerRoutes = require('./routes/customerRoutes');
const crmRoutes = require('./routes/crmRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const satisfactionRoutes = require('./routes/satisfactionRoutes');
const publicRoutes = require('./routes/publicRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

app.use(cors({
  origin: [
    'https://motorshow-management-system-xpuj-79rgulgoh.vercel.app',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'))
);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'MotorShow Management System API is running.'
  });
});

// Rute publik (tanpa login)
app.use('/api/public', publicRoutes);

// Rute internal (butuh login: Admin/Sales)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/motorcycles', motorcycleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/activities', crmRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/satisfaction', satisfactionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan.'
  });
});

app.use(errorHandler);

module.exports = app;