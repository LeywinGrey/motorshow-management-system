const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/motorcycleController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);
router.get('/summary', ctrl.getMotorcycleSummary);
router.get('/', ctrl.getMotorcycles);
router.get('/:id', ctrl.getMotorcycleById);
router.post('/', authorize('admin'), upload.single('image'), ctrl.createMotorcycle);
router.put('/:id', authorize('admin'), upload.single('image'), ctrl.updateMotorcycle);
router.delete('/:id', authorize('admin'), ctrl.deleteMotorcycle);

module.exports = router;
