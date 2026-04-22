const express = require('express');
const router = express.Router();
const {
    createBooking, getMyBookings, getDealerBookings,
    getAllBookings, getBooking, updateBookingStatus,
} = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { createBookingRules, updateStatusRules } = require('../validators/bookingValidators');

router.use(protect);

// Named paths before /:id
router.post('/', restrictTo('WAREHOUSE', 'ADMIN'), createBookingRules, validate, createBooking);
router.get('/my', restrictTo('WAREHOUSE'), getMyBookings);
router.get('/dealer', restrictTo('DEALER'), getDealerBookings);
router.get('/', restrictTo('ADMIN'), getAllBookings);

// Parameterised
router.get('/:id', getBooking);
router.patch('/:id/status', updateStatusRules, validate, updateBookingStatus);

module.exports = router;
