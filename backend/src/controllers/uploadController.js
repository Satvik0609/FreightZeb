/**
 * controllers/uploadController.js
 * Hardened against path traversal. Uses asyncHandler.
 */

const path = require('path');
const fs = require('fs');
const { prisma } = require('../config/db');
const logger = require('../config/logger');
const { asyncHandler, AppError } = require('../helpers/errors');

const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

/**
 * Converts an absolute file path to a safe public URL.
 * Throws if the resolved path escapes UPLOADS_ROOT.
 */
function fileUrl(absPath) {
    const resolved = path.resolve(absPath);
    if (!resolved.startsWith(UPLOADS_ROOT + path.sep) && resolved !== UPLOADS_ROOT) {
        throw AppError.badRequest('Invalid file path');
    }
    const relative = path.relative(UPLOADS_ROOT, resolved).replace(/\\/g, '/');
    return `/uploads/${relative}`;
}

function deleteFile(absPath) {
    try {
        const resolved = path.resolve(absPath);
        if (resolved.startsWith(UPLOADS_ROOT) && fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
        }
    } catch (err) {
        logger.warn(`Could not delete file: ${err.message}`);
    }
}

// ── POST /api/uploads/proof/:bookingId ───────────────────────────────────────
const uploadProofOfDelivery = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { notes } = req.body;

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { dealerId: true, warehouseId: true, status: true, proofOfDelivery: true },
    });

    if (!booking) {
        req.files?.photos?.forEach((f) => deleteFile(f.path));
        if (req.files?.signature?.[0]) deleteFile(req.files.signature[0].path);
        throw AppError.notFound('Booking not found');
    }

    if (booking.dealerId !== req.user.id && req.user.role !== 'ADMIN') {
        req.files?.photos?.forEach((f) => deleteFile(f.path));
        if (req.files?.signature?.[0]) deleteFile(req.files.signature[0].path);
        throw AppError.forbidden();
    }

    const ACTIVE = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
    if (!ACTIVE.includes(booking.status)) {
        req.files?.photos?.forEach((f) => deleteFile(f.path));
        if (req.files?.signature?.[0]) deleteFile(req.files.signature[0].path);
        throw AppError.badRequest('Proof can only be uploaded for active or delivered bookings');
    }

    const newPhotos = (req.files?.photos || []).map((f) => fileUrl(f.path));
    const signatureUrl = req.files?.signature?.[0] ? fileUrl(req.files.signature[0].path) : null;
    const existing = booking.proofOfDelivery || {};

    const proofOfDelivery = {
        photos: [...(existing.photos || []), ...newPhotos],
        signature: signatureUrl || existing.signature || null,
        notes: notes || existing.notes || null,
        submittedAt: new Date().toISOString(),
        submittedBy: req.user.id,
    };

    const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { proofOfDelivery },
    });

    req.app.get('io').to(`warehouse:${booking.warehouseId}`).emit('booking:proofUploaded', { bookingId, proofOfDelivery });
    logger.info(`Proof uploaded for booking ${bookingId}`);
    res.json({ success: true, proofOfDelivery: updated.proofOfDelivery });
});

// ── GET /api/uploads/proof/:bookingId ────────────────────────────────────────
const getProofOfDelivery = asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
        where: { id: req.params.bookingId },
        select: { id: true, status: true, proofOfDelivery: true, warehouseId: true, dealerId: true },
    });

    if (!booking) throw AppError.notFound('Booking not found');

    const allowed =
        booking.warehouseId === req.user.id ||
        booking.dealerId === req.user.id ||
        req.user.role === 'ADMIN';
    if (!allowed) throw AppError.forbidden();

    if (!booking.proofOfDelivery) throw AppError.notFound('No proof of delivery uploaded yet');

    res.json({ success: true, bookingId: booking.id, proofOfDelivery: booking.proofOfDelivery });
});

// ── POST /api/uploads/avatar ─────────────────────────────────────────────────
const uploadAvatar = asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No file uploaded');

    const url = fileUrl(req.file.path);

    const existingUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { avatarUrl: true },
    });
    if (existingUser?.avatarUrl) {
        const oldAbs = path.join(UPLOADS_ROOT, existingUser.avatarUrl.replace('/uploads/', ''));
        deleteFile(oldAbs);
    }

    const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { avatarUrl: url },
        select: { id: true, email: true, name: true, avatarUrl: true },
    });

    res.json({ success: true, user });
});

// ── DELETE /api/uploads/avatar ───────────────────────────────────────────────
const deleteAvatar = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { avatarUrl: true },
    });

    if (user?.avatarUrl) {
        deleteFile(path.join(UPLOADS_ROOT, user.avatarUrl.replace('/uploads/', '')));
    }

    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: null } });
    res.json({ success: true, message: 'Avatar removed' });
});

// ── POST /api/uploads/document/:shipmentId ───────────────────────────────────
const uploadShipmentDocument = asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No file uploaded');

    const shipment = await prisma.shipment.findUnique({
        where: { id: req.params.shipmentId },
        select: { warehouseId: true },
    });

    if (!shipment) {
        deleteFile(req.file.path);
        throw AppError.notFound('Shipment not found');
    }

    if (shipment.warehouseId !== req.user.id && req.user.role !== 'ADMIN') {
        deleteFile(req.file.path);
        throw AppError.forbidden();
    }

    const url = fileUrl(req.file.path);
    const newDoc = JSON.stringify({
        url,
        name: path.basename(req.file.originalname).replace(/[^\w.\- ]/g, '').slice(0, 255),
        uploadedAt: new Date().toISOString(),
    });

    // Atomic jsonb append — avoids read-modify-write race
    await prisma.$executeRaw`
    UPDATE "Shipment"
    SET requirements = jsonb_set(
      COALESCE(requirements, '{}'),
      '{documents}',
      COALESCE(requirements->'documents', '[]') || ${newDoc}::jsonb
    )
    WHERE id = ${req.params.shipmentId}
  `;

    const updated = await prisma.shipment.findUnique({
        where: { id: req.params.shipmentId },
        select: { requirements: true },
    });

    res.json({ success: true, documents: updated.requirements?.documents ?? [] });
});

module.exports = {
    uploadProofOfDelivery,
    getProofOfDelivery,
    uploadAvatar,
    deleteAvatar,
    uploadShipmentDocument,
};
