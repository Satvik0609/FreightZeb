/**
 * CRON SERVICE
 * Scheduled background jobs.
 * Runs inside the same Node process — for high-scale, move to a separate worker.
 */

const cron = require('node-cron');
const { prisma } = require('../config/db');
const logger = require('../config/logger');

// ── Job 1: Mark overdue invoices ─────────────────────────────────────────────
// Runs every day at 02:00 AM
function scheduleOverdueInvoices() {
    cron.schedule('0 2 * * *', async () => {
        try {
            const result = await prisma.invoice.updateMany({
                where: {
                    status: 'PENDING',
                    dueDate: { lt: new Date() },
                },
                data: { status: 'OVERDUE' },
            });
            if (result.count > 0) {
                logger.info(`Cron: marked ${result.count} invoice(s) as OVERDUE`);
            }
        } catch (err) {
            logger.error(`Cron overdue invoices failed: ${err.message}`);
        }
    });
    logger.info('Cron: overdue invoice job scheduled (daily 02:00)');
}

// ── Job 2: Clean up expired password reset tokens ────────────────────────────
// Runs every hour
function scheduleTokenCleanup() {
    cron.schedule('0 * * * *', async () => {
        try {
            const result = await prisma.user.updateMany({
                where: {
                    passwordResetToken: { not: null },
                    passwordResetExpiry: { lt: new Date() },
                },
                data: { passwordResetToken: null, passwordResetExpiry: null },
            });
            if (result.count > 0) {
                logger.info(`Cron: cleaned ${result.count} expired reset token(s)`);
            }
        } catch (err) {
            logger.error(`Cron token cleanup failed: ${err.message}`);
        }
    });
    logger.info('Cron: token cleanup job scheduled (hourly)');
}

// ── Job 3: Clean old read notifications (older than 30 days) ─────────────────
// Runs every Sunday at 03:00 AM
function scheduleNotificationCleanup() {
    cron.schedule('0 3 * * 0', async () => {
        try {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const result = await prisma.notification.deleteMany({
                where: { isRead: true, createdAt: { lt: cutoff } },
            });
            if (result.count > 0) {
                logger.info(`Cron: deleted ${result.count} old notification(s)`);
            }
        } catch (err) {
            logger.error(`Cron notification cleanup failed: ${err.message}`);
        }
    });
    logger.info('Cron: notification cleanup scheduled (weekly Sunday 03:00)');
}

function startAllJobs() {
    scheduleOverdueInvoices();
    scheduleTokenCleanup();
    scheduleNotificationCleanup();
    logger.info('All cron jobs started');
}

module.exports = { startAllJobs };
