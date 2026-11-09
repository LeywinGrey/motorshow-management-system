const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/motorcycleController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Semua role internal (Admin & Sales) boleh melihat/mencari stok.
// Pelanggan tidak punya akun, sehingga tidak ada akses ke rute ini.
router.use(authenticate);
router.get('/summary', ctrl.getMotorcycleSummary);
router.get('/stock-summary', ctrl.getStockSummary);
router.get('/filters', ctrl.getFilterOptions);
router.get('/export', authorize('admin'), ctrl.exportMotorcycles);
router.post('/import', authorize('admin'), ctrl.importMotorcycles);
router.get('/', ctrl.getMotorcycles);
router.get('/:id', ctrl.getMotorcycleById);
router.post('/', authorize('admin'), upload.single('image'), ctrl.createMotorcycle);
router.put('/:id', authorize('admin'), upload.single('image'), ctrl.updateMotorcycle);
router.delete('/:id', authorize('admin'), ctrl.deleteMotorcycle);

module.exports = router;
