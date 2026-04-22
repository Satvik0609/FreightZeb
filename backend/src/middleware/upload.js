const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MAX_SIZE_MB = 5;
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXT = /\.(jpeg|jpg|png|webp|pdf)$/i;

// Ensure a directory exists
function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Dynamic storage — subfolder determined by req.uploadFolder (set per route)
const storage = multer.diskStorage({
    destination(req, _file, cb) {
        const folder = path.join(__dirname, '../../uploads', req.uploadFolder || 'misc');
        ensureDir(folder);
        cb(null, folder);
    },
    filename(_req, file, cb) {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
    },
});

function fileFilter(_req, file, cb) {
    const validMime = ALLOWED_MIME.includes(file.mimetype);
    const validExt = ALLOWED_EXT.test(file.originalname);
    if (validMime && validExt) {
        cb(null, true);
    } else {
        cb(Object.assign(new Error('Invalid file type. Allowed: jpeg, jpg, png, webp, pdf'), { statusCode: 400 }));
    }
}

const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    fileFilter,
});

// ── Middleware factories ──────────────────────────────────────────────────────

/** For proof-of-delivery: up to 5 photos + 1 signature image */
function proofOfDeliveryUpload(req, _res, next) {
    req.uploadFolder = 'proof-of-delivery';
    next();
}

/** For user avatar: single image */
function avatarUpload(req, _res, next) {
    req.uploadFolder = 'avatars';
    next();
}

/** For shipment documents: single PDF or image */
function documentUpload(req, _res, next) {
    req.uploadFolder = 'documents';
    next();
}

module.exports = {
    upload,
    proofOfDeliveryUpload,
    avatarUpload,
    documentUpload,
};
