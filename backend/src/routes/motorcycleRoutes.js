const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/motorcycleController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const uploadExcel = require('../middleware/uploadExcel');

router.use(authenticate);

// Admin & Sales: lihat, cari, filter, ringkasan stok
router.get('/summary', ctrl.getMotorcycleSummary);
router.get('/stock-summary', ctrl.getStockSummary);
router.get('/filter-options', ctrl.getFilterOptions);

// Admin saja: export, template & import Excel (harus di atas '/:id')
router.get('/export', authorize('admin'), ctrl.exportMotorcycles);
router.get('/import-template', authorize('admin'), ctrl.downloadTemplate);
router.post('/import', authorize('admin'), uploadExcel.single('file'), ctrl.importMotorcycles);

router.get('/', ctrl.getMotorcycles);
router.get('/:id', ctrl.getMotorcycleById);
router.post('/', authorize('admin'), upload.single('image'), ctrl.createMotorcycle);
router.put('/:id', authorize('admin'), upload.single('image'), ctrl.updateMotorcycle);
router.delete('/:id', authorize('admin'), ctrl.deleteMotorcycle);

module.exports = router;
