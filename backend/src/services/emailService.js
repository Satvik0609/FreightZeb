/**
 * EMAIL SERVICE
 * Uses nodemailer. Configure SMTP via ENV variables.
 * Falls back to console log in development if SMTP not configured.
 */

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

function createTransport() {
    if (!process.env.SMTP_HOST) {
        // Dev fallback — log emails to console
        return null;
    }
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

const transporter = createTransport();

async function sendMail({ to, subject, html, text }) {
    if (!transporter) {
        logger.info(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
        return;
    }
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@FreightZeb.com',
            to,
            subject,
            html,
            text,
        });
        logger.info(`Email sent to ${to}: ${subject}`);
    } catch (err) {
        logger.error(`Email failed to ${to}: ${err.message}`);
    }
}

// ── Templates ────────────────────────────────────────────────────────────────

async function sendWelcome({ to, name }) {
    await sendMail({
        to,
        subject: 'Welcome to FreightZeb',
        html: `<h2>Welcome, ${name}!</h2><p>Your account has been created successfully.</p>`,
        text: `Welcome, ${name}! Your account has been created successfully.`,
    });
}

async function sendBookingConfirmation({ to, bookingId, shipmentId, truckRegNo, estimatedEta }) {
    await sendMail({
        to,
        subject: `Booking Confirmed — #${bookingId.slice(0, 8)}`,
        html: `
      <h2>Booking Confirmed</h2>
      <p>Your booking <strong>#${bookingId.slice(0, 8)}</strong> has been approved.</p>
      <ul>
        <li>Shipment ID: ${shipmentId.slice(0, 8)}</li>
        <li>Truck: ${truckRegNo}</li>
        <li>Estimated ETA: ${estimatedEta ? new Date(estimatedEta).toLocaleString() : 'TBD'}</li>
      </ul>
    `,
        text: `Booking #${bookingId.slice(0, 8)} confirmed. Truck: ${truckRegNo}`,
    });
}

async function sendDeliveryConfirmation({ to, bookingId, deliveredAt }) {
    await sendMail({
        to,
        subject: `Shipment Delivered — #${bookingId.slice(0, 8)}`,
        html: `
      <h2>Shipment Delivered</h2>
      <p>Your shipment for booking <strong>#${bookingId.slice(0, 8)}</strong> was delivered on ${new Date(deliveredAt).toLocaleString()}.</p>
    `,
        text: `Shipment for booking #${bookingId.slice(0, 8)} delivered.`,
    });
}

async function sendPasswordReset({ to, resetToken }) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await sendMail({
        to,
        subject: 'Password Reset Request',
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
        text: `Reset your password: ${resetUrl}`,
    });
}

module.exports = { sendMail, sendWelcome, sendBookingConfirmation, sendDeliveryConfirmation, sendPasswordReset };
