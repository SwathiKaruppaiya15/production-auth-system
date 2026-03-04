const crypto = require('crypto');
const bcrypt = require('bcrypt');

/**
 * Generate cryptographically secure random token
 */
exports.generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Hash token using SHA-256 for verification/reset tokens
 * Using SHA-256 instead of bcrypt for tokens because:
 * 1. Tokens are already cryptographically secure random strings
 * 2. We need fast comparison for one-time use tokens
 * 3. No need for salt since tokens are unique and random
 * 4. bcrypt is designed for passwords, not one-time tokens
 */
exports.hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Verify token against hash
 */
exports.verifyToken = (token, hashedToken) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hashedToken));
};

/**
 * Generate verification token with 24-hour expiry
 */
exports.generateVerificationToken = () => {
  return {
    token: exports.generateSecureToken(32),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
};

/**
 * Generate password reset token with 15-minute expiry
 */
exports.generatePasswordResetToken = () => {
  return {
    token: exports.generateSecureToken(32),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  };
};

/**
 * Check if token has expired
 */
exports.isTokenExpired = (expiresAt) => {
  return new Date() > new Date(expiresAt);
};
