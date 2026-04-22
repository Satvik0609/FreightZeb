const { prisma } = require('../config/db');
const logger = require('../config/logger');

// Warehouse: get own invoices
async function getMyInvoices(req, res, next) {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = { userId: req.user.id };
        if (status) where.status = status;

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    booking: {
                        include: {
                            shipment: true,
                            truck: { select: { registrationNo: true, truckType: true } },
                            dealer: { select: { name: true, company: true } },
                        },
                    },
                },
                orderBy: { issuedAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.invoice.count({ where }),
        ]);

        res.json({ success: true, total, page: Number(page), limit: Number(limit), invoices });
    } catch (err) {
        next(err);
    }
}

// Admin: all invoices
async function getAllInvoices(req, res, next) {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {};
        if (status) where.status = status;

        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true, company: true } },
                    booking: {
                        include: {
                            truck: { select: { registrationNo: true } },
                            dealer: { select: { name: true, company: true } },
                        },
                    },
                },
                orderBy: { issuedAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.invoice.count({ where }),
        ]);

        res.json({ success: true, total, page: Number(page), limit: Number(limit), invoices });
    } catch (err) {
        next(err);
    }
}

// Get single invoice
async function getInvoice(req, res, next) {
    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { id: true, name: true, email: true, company: true } },
                booking: {
                    include: {
                        shipment: true,
                        truck: true,
                        dealer: { select: { name: true, email: true, phone: true, company: true } },
                    },
                },
            },
        });

        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

        const isOwner = invoice.userId === req.user.id;
        const isAdmin = req.user.role === 'ADMIN';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        res.json({ success: true, invoice });
    } catch (err) {
        next(err);
    }
}

// Admin: mark invoice as paid
async function markPaid(req, res, next) {
    try {
        const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
        if (invoice.status === 'PAID') {
            return res.status(400).json({ success: false, message: 'Invoice already paid' });
        }

        const updated = await prisma.invoice.update({
            where: { id: req.params.id },
            data: { status: 'PAID', paidAt: new Date() },
        });

        logger.info(`Invoice ${invoice.invoiceNo} marked as paid`);
        res.json({ success: true, invoice: updated });
    } catch (err) {
        next(err);
    }
}

// Admin: cancel invoice
async function cancelInvoice(req, res, next) {
    try {
        const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
        if (invoice.status === 'PAID') {
            return res.status(400).json({ success: false, message: 'Cannot cancel a paid invoice' });
        }

        const updated = await prisma.invoice.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' },
        });

        res.json({ success: true, invoice: updated });
    } catch (err) {
        next(err);
    }
}

module.exports = { getMyInvoices, getAllInvoices, getInvoice, markPaid, cancelInvoice };
