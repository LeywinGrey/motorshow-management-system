const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/admin', authorize('admin'), ctrl.getAdminDashboard);
router.get('/sales', authorize('sales'), ctrl.getSalesDashboard);

module.exports = router;
