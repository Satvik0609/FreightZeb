/**
 * ENV VALIDATION — fails fast on startup if required vars are missing.
 * Import this FIRST in server.js before anything else.
 */

const REQUIRED = [
    'DATABASE_URL',
    'JWT_SECRET',
];

const OPTIONAL_DEFAULTS = {
    PORT: '5000',
    NODE_ENV: 'development',
    JWT_EXPIRES_IN: '7d',
    FRONTEND_URL: 'http://localhost:3000',
    ML_SERVICE_URL: 'http://localhost:8000',
    ML_SERVICE_API_KEY: 'dev-ml-service-key',
    ML_TIMEOUT_MS: '10000',
};

function validateEnv() {
    const missing = REQUIRED.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        console.error('\n❌ Missing required environment variables:');
        missing.forEach((key) => console.error(`   - ${key}`));
        console.error('\nCopy .env.example to .env and fill in the values.\n');
        process.exit(1);
    }

    // Apply defaults for optional vars
    Object.entries(OPTIONAL_DEFAULTS).forEach(([key, val]) => {
        if (!process.env[key]) process.env[key] = val;
    });

    if (process.env.JWT_SECRET.length < 32) {
        console.error('❌ JWT_SECRET must be at least 32 characters long.');
        process.exit(1);
    }

    console.log('✅ Environment validated');
}

module.exports = { validateEnv };
