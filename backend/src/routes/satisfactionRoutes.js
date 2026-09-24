const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/satisfactionController');
const { authenticate } = require('../middleware/auth');

// Rute internal (butuh login) untuk Admin/Sales melihat hasil penilaian
router.get('/', authenticate, ctrl.getSatisfactionList);

module.exports = router;
