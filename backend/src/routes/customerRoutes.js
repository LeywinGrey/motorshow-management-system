const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerController');
const crmCtrl = require('../controllers/crmController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', ctrl.getCustomers);
router.get('/:id', ctrl.getCustomerById);
router.post('/', ctrl.createCustomer);
router.put('/:id', ctrl.updateCustomer);
router.put('/:id/assign', authorize('admin'), ctrl.assignSales);
router.delete('/:id', authorize('admin'), ctrl.deleteCustomer);

// Sales CRM activities (nested di bawah customer)
router.get('/:customerId/activities', crmCtrl.getActivities);
router.post('/:customerId/activities', crmCtrl.createActivity);

module.exports = router;
