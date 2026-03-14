const express = require('express');
const router = express.Router();
const { createShipment, getMyShipments, getShipment } = require('../controllers/shipmentController');

router.post('/', createShipment);
router.get('/', getMyShipments);
router.get('/:id', getShipment);

module.exports = router;