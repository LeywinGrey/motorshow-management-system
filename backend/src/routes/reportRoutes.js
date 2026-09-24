const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));
router.get('/inventory', ctrl.inventoryReport);
router.get('/sales', ctrl.salesReport);
router.get('/test-drive', ctrl.testDriveReport);
router.get('/satisfaction', ctrl.satisfactionReport);

module.exports = router;
