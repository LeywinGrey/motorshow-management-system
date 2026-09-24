const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/sales', ctrl.getSalesList); // Admin & Sales boleh melihat daftar sales (untuk dropdown)
router.get('/', authorize('admin'), ctrl.getUsers);
router.post('/', authorize('admin'), ctrl.createUser);
router.put('/:id', authorize('admin'), ctrl.updateUser);
router.delete('/:id', authorize('admin'), ctrl.deleteUser);

module.exports = router;
