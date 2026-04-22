const express = require('express');
const router = express.Router();
const {
    getAllUsers, getUser, updateUserRole, toggleUserActive, deleteUser,
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect, restrictTo('ADMIN'));

router.get('/users', getAllUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/toggle', toggleUserActive);
router.delete('/users/:id', deleteUser);

module.exports = router;
