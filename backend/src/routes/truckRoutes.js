const express = require('express');
const router = express.Router();
const {
  createTruck,
  getAllTrucks,
  getTruck,
  updateTruck,
  deleteTruck
} = require('../controllers/truckController');

router.post('/', createTruck);
router.get('/', getAllTrucks);
router.get('/:id', getTruck);
router.put('/:id', updateTruck);
router.delete('/:id', deleteTruck);

module.exports = router;
