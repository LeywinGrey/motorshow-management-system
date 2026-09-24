const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/calendar', ctrl.getCalendar);
router.get('/', ctrl.getBookings);
router.get('/:id', ctrl.getBookingById);
router.post('/', ctrl.createBooking);
router.put('/:id', ctrl.updateBooking);
router.put('/:id/status', ctrl.updateBookingStatus);
router.put('/:id/cancel', ctrl.cancelBooking);

module.exports = router;
