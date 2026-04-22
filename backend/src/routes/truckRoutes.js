const express = require('express');
const router = express.Router();
const {
    createTruck, getMyTrucks, getAllTrucks, getAvailableTrucks,
    getTruck, updateTruck, updateTruckLocation, deleteTruck,
} = require('../controllers/truckController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { createTruckRules, locationRules } = require('../validators/truckValidators');

router.use(protect);

// Specific named paths BEFORE /:id
router.post('/', restrictTo('DEALER', 'ADMIN'), createTruckRules, validate, createTruck);
router.get('/my', restrictTo('DEALER'), getMyTrucks);
router.get('/available', getAvailableTrucks);
router.get('/', restrictTo('ADMIN'), getAllTrucks);

// Parameterised paths
router.get('/:id', getTruck);
router.patch('/:id', updateTruck);
router.patch('/:id/location', restrictTo('DEALER', 'ADMIN'), locationRules, validate, updateTruckLocation);
router.delete('/:id', restrictTo('ADMIN'), deleteTruck);

module.exports = router;
