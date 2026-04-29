/**
 * CRON SERVICE
 * Scheduled background jobs.
 * Runs inside the same Node process — for high-scale, move to a separate worker.
 */

const cron = require('node-cron');
const { prisma } = require('../config/db');
const logger = require('../config/logger');
const mlService = require('./mlService');

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

// ── Job 4: ML telemetry report + optional auto-retrain ───────────────────────
// Report hourly, retrain daily at 04:00 if enabled
function scheduleMlMaintenance() {
    cron.schedule('0 * * * *', async () => {
        try {
            const telemetry = mlService.getTelemetry();
            logger.info(`Cron ML report: requests=${telemetry.requests}, fallbackRate=${telemetry.fallbackRatePercent}% degraded=${telemetry.degraded}`);
        } catch (err) {
            logger.error(`Cron ML report failed: ${err.message}`);
        }
    });
    logger.info('Cron: ML report job scheduled (hourly)');

    cron.schedule('0 4 * * *', async () => {
        const enabled = String(process.env.ML_AUTO_RETRAIN_ENABLED || 'false').toLowerCase() === 'true';
        if (!enabled) return;
        try {
            const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
            const authHeader = process.env.ML_RETRAIN_AUTH_HEADER || '';
            if (!authHeader) {
                logger.warn('Cron ML retrain skipped: ML_RETRAIN_AUTH_HEADER not configured');
                return;
            }
            await mlService.triggerRetrain(`cron-${Date.now()}`, backendUrl, authHeader);
            logger.info('Cron ML retrain completed successfully');
        } catch (err) {
            logger.error(`Cron ML retrain failed: ${err.message}`);
        }
    });
    logger.info('Cron: ML auto-retrain scheduled (daily 04:00, env-gated)');
}

function startAllJobs() {
    scheduleOverdueInvoices();
    scheduleTokenCleanup();
    scheduleNotificationCleanup();
    scheduleMlMaintenance();
    logger.info('All cron jobs started');
}

module.exports = { startAllJobs };
