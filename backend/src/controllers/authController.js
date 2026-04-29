const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/db');
const logger = require('../config/logger');
const emailService = require('../services/emailService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/** Hash a plain token before storing — prevents DB leaks being usable */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Controllers ───────────────────────────────────────────────────────────────

async function register(req, res, next) {
  try {
    const { email, password, name, role, phone, company } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Prevent self-promotion to ADMIN via public registration
    const allowedRoles = ['WAREHOUSE', 'DEALER', 'CARGO_DEALER'];
    const assignedRole = allowedRoles.includes(role) ? role : 'WAREHOUSE';

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: assignedRole, phone, company },
    });

    const token = signToken(user);
    logger.info(`User registered: ${user.email} [${user.role}]`);

    emailService.sendWelcome({ to: user.email, name: user.name }).catch(() => { });

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user);
    logger.info(`User login: ${user.email}`);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, role: true,
        phone: true, company: true, avatarUrl: true,
        isActive: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { name, phone, company } = req.body;
    // Only update fields that were explicitly provided
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (company !== undefined) data.company = company;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, email: true, name: true, role: true, phone: true, company: true },
    });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed, passwordChangedAt: new Date() },
    });

    logger.info(`Password changed for user: ${user.email}`);
    res.json({ success: true, message: 'Password updated. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    // Always return same response to prevent email enumeration
    const SAFE_RESPONSE = { success: true, message: 'If that email exists, a reset link was sent' };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return res.json(SAFE_RESPONSE);

    const plainToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = hashToken(plainToken);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: hashedToken, passwordResetExpiry: expiry },
    });

    emailService.sendPasswordReset({ to: user.email, resetToken: plainToken }).catch(() => { });
    logger.info(`Password reset requested for: ${user.email}`);

    res.json(SAFE_RESPONSE);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const hashedToken = hashToken(token);
    const existingUser = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: { gt: new Date() },
      },
      select: { email: true },
    });

    if (!existingUser) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    const result = await prisma.user.updateMany({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpiry: { gt: new Date() },
      },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpiry: null,
        passwordChangedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    logger.info(`Password reset completed for: ${existingUser.email}`);
    res.json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register, login, getMe, updateMe,
  changePassword, forgotPassword, resetPassword,
};
