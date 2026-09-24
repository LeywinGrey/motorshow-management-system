const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/satisfactionController');

// Rute PUBLIK tanpa login, khusus halaman Penilaian Kepuasan Pelanggan
router.get('/satisfaction/verify/:bookingCode', ctrl.verifyBookingCode);
router.post('/satisfaction/submit', ctrl.submitSatisfaction);

module.exports = router;
