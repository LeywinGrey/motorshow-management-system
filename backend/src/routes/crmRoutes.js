const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/crmController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.put('/:id', ctrl.updateActivity);
router.delete('/:id', ctrl.deleteActivity);

module.exports = router;
