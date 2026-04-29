const express = require('express');
const router = express.Router();
const {
    getMyNotifications, markRead, markAllRead, deleteNotification,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// /read-all must be before /:id to avoid being matched as an ID
router.get('/', getMyNotifications);
router.patch('/read-all', markAllRead);
router.patch('/mark-all-read', markAllRead); // alias for frontend clarity
router.patch('/:id/read', markRead);
router.delete('/:id', deleteNotification);

module.exports = router;
