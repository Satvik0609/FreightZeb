const express = require('express');
const router = express.Router();
const {
    getMyInvoices, getAllInvoices, getInvoice, markPaid, cancelInvoice,
} = require('../controllers/invoiceController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// Specific paths before parameterised /:id
router.get('/my', restrictTo('WAREHOUSE', 'ADMIN'), getMyInvoices);
router.get('/', restrictTo('ADMIN'), getAllInvoices);
router.get('/:id', getInvoice);
router.patch('/:id/pay', restrictTo('ADMIN'), markPaid);
router.patch('/:id/cancel', restrictTo('ADMIN'), cancelInvoice);

module.exports = router;
