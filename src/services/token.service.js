const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const SALT_ROUNDS = 12;

/**
 * Generate a cryptographically secure refresh token
 */
exports.generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash refresh token for storage
 * Using bcrypt for consistency with password hashing and built-in salt management
 */
exports.hashRefreshToken = async (token) => {
  return await bcrypt.hash(token, SALT_ROUNDS);
};

/**
 * Verify refresh token against stored hash
 */
exports.verifyRefreshToken = async (token, hashedToken) => {
  return await bcrypt.compare(token, hashedToken);
};

/**
 * Generate token ID for refresh token tracking
 */
exports.generateTokenId = () => {
  return uuidv4();
};

/**
 * Calculate expiration date for refresh token (7 days)
 */
exports.calculateRefreshTokenExpiry = () => {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
};

/**
 * Check if token has expired
 */
exports.isTokenExpired = (expiresAt) => {
  return new Date() > new Date(expiresAt);
};
