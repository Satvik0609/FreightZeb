const express = require('express');
const router = express.Router();
const {
    uploadProofOfDelivery,
    getProofOfDelivery,
    uploadAvatar,
    deleteAvatar,
    uploadShipmentDocument,
} = require('../controllers/uploadController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { upload, proofOfDeliveryUpload, avatarUpload, documentUpload } = require('../middleware/upload');

router.use(protect);
router.use(uploadLimiter);

// ── Proof of delivery ─────────────────────────────────────────────────────────
// POST  /api/uploads/proof/:bookingId  — dealer uploads photos + signature
// GET   /api/uploads/proof/:bookingId  — warehouse/dealer/admin views proof
// NOTE: folder-setter middleware (proofOfDeliveryUpload) MUST come before upload.*()
// because Multer's storage.destination() reads req.uploadFolder synchronously.
router.post(
    '/proof/:bookingId',
    restrictTo('DEALER', 'ADMIN'),
    proofOfDeliveryUpload,                         // sets req.uploadFolder = 'proof-of-delivery'
    upload.fields([
        { name: 'photos', maxCount: 5 },
        { name: 'signature', maxCount: 1 },
    ]),
    uploadProofOfDelivery
);

router.get('/proof/:bookingId', getProofOfDelivery);

// ── Avatar ────────────────────────────────────────────────────────────────────
// POST   /api/uploads/avatar  — upload/replace avatar
// DELETE /api/uploads/avatar  — remove avatar
router.post(
    '/avatar',
    avatarUpload,                                  // sets req.uploadFolder = 'avatars'
    upload.single('avatar'),
    uploadAvatar
);

router.delete('/avatar', deleteAvatar);

// ── Shipment documents ────────────────────────────────────────────────────────
// POST /api/uploads/document/:shipmentId  — attach PDF/image to shipment
router.post(
    '/document/:shipmentId',
    restrictTo('WAREHOUSE', 'ADMIN'),
    documentUpload,                                // sets req.uploadFolder = 'documents'
    upload.single('document'),
    uploadShipmentDocument
);

module.exports = router;
