const express = require('express');
const router = express.Router();
const {
    getAllUsers, getUser, updateUserRole, toggleUserActive, deleteUser,
    getFinanceSummary, getAuditLogs, getSystemHealth,
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect, restrictTo('ADMIN'));

router.get('/users', getAllUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/toggle', toggleUserActive);
router.delete('/users/:id', deleteUser);
router.get('/finance/summary', getFinanceSummary);
router.get('/audit-logs', getAuditLogs);
router.get('/system-health', getSystemHealth);

module.exports = router;
