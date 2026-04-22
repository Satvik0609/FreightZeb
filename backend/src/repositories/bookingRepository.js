/**
 * repositories/bookingRepository.js
 * All Prisma queries for Booking live here.
 * Controllers / Services never import prisma directly for booking queries.
 */

const { prisma } = require('../config/db');

const BOOKING_DETAIL_INCLUDE = {
    shipment: true,
    truck: true,
    warehouse: { select: { id: true, name: true, email: true, company: true } },
    dealer: { select: { id: true, name: true, email: true, phone: true, company: true } },
    trackingLogs: { orderBy: { timestamp: 'asc' } },
    invoice: true,
};

async function findById(id) {
    return prisma.booking.findUnique({ where: { id }, include: BOOKING_DETAIL_INCLUDE });
}

async function findByWarehouse(warehouseId, { status, skip, limit }) {
    const where = { warehouseId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
        prisma.booking.findMany({
            where,
            include: {
                shipment: true,
                truck: true,
                dealer: { select: { id: true, name: true, email: true, phone: true, company: true } },
                trackingLogs: { orderBy: { timestamp: 'desc' }, take: 1 },
                invoice: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.booking.count({ where }),
    ]);

    return { items, total };
}

async function findByDealer(dealerId, { status, skip, limit }) {
    const where = { dealerId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
        prisma.booking.findMany({
            where,
            include: {
                shipment: true,
                truck: true,
                warehouse: { select: { id: true, name: true, email: true, company: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.booking.count({ where }),
    ]);

    return { items, total };
}

async function findAll({ status, skip, limit }) {
    const where = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
        prisma.booking.findMany({
            where,
            include: {
                shipment: true,
                truck: true,
                warehouse: { select: { id: true, name: true, company: true } },
                dealer: { select: { id: true, name: true, company: true } },
                invoice: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.booking.count({ where }),
    ]);

    return { items, total };
}

/**
 * Create booking inside a serialisable transaction.
 * Retries up to `maxRetries` times on P2034 (write-write conflict).
 */
async function createWithRetry(data, maxRetries = 3) {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Reserve truck atomically
                const reserved = await tx.truck.updateMany({
                    where: { id: data.truckId, status: 'AVAILABLE', availability: true },
                    data: { availability: false },
                });
                if (reserved.count === 0) {
                    const err = new Error('Truck is not available');
                    err.statusCode = 400;
                    err.code = 'TRUCK_UNAVAILABLE';
                    throw err;
                }

                // 2. Validate shipment status
                const liveShipment = await tx.shipment.findUnique({
                    where: { id: data.shipmentId },
                    select: { status: true },
                });
                if (!liveShipment) {
                    const err = new Error('Shipment not found');
                    err.statusCode = 404;
                    throw err;
                }
                const blocked = ['BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
                if (blocked.includes(liveShipment.status)) {
                    const err = new Error(`Shipment is already ${liveShipment.status}`);
                    err.statusCode = 400;
                    err.code = 'SHIPMENT_NOT_AVAILABLE';
                    throw err;
                }

                // 3. Ensure no duplicate active booking for this truck
                const existing = await tx.booking.findFirst({
                    where: {
                        truckId: data.truckId,
                        status: { in: ['REQUESTED', 'APPROVED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] },
                    },
                    select: { id: true },
                });
                if (existing) {
                    const err = new Error('Truck already has an active booking');
                    err.statusCode = 409;
                    err.code = 'TRUCK_ALREADY_BOOKED';
                    throw err;
                }

                // 4. Create booking + update shipment
                const booking = await tx.booking.create({ data: { ...data, status: 'REQUESTED' } });
                await tx.shipment.update({ where: { id: data.shipmentId }, data: { status: 'BOOKED' } });
                return booking;
            }, { isolationLevel: 'Serializable', timeout: 10_000 });

        } catch (err) {
            if (err.code === 'P2034' && attempt < maxRetries - 1) {
                attempt++;
                await new Promise((r) => setTimeout(r, 50 * attempt)); // exponential backoff
                continue;
            }
            throw err;
        }
    }
}

async function updateStatus(id, data) {
    return prisma.booking.update({ where: { id }, data });
}

module.exports = { findById, findByWarehouse, findByDealer, findAll, createWithRetry, updateStatus };
