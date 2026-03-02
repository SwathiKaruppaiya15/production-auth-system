const pool = require("../config/db");

/**
 * Store refresh token in database
 */
exports.createRefreshToken = async ({ id, user_id, token, expires_at }) => {
  const query = `
    INSERT INTO refresh_tokens (id, user_id, token, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, expires_at, created_at
  `;

  const values = [id, user_id, token, expires_at];

  const result = await pool.query(query, values);

  return result.rows[0];
};

/**
 * Find refresh token by user ID and token hash
 */
exports.findRefreshToken = async (user_id, token) => {
  const query = `
    SELECT * FROM refresh_tokens 
    WHERE user_id = $1 AND token = $2
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [user_id, token]);

  return result.rows[0];
};

/**
 * Delete refresh token by ID
 */
exports.deleteRefreshToken = async (id) => {
  const query = `
    DELETE FROM refresh_tokens 
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);

  return result.rows[0];
};

/**
 * Delete all refresh tokens for a user
 */
exports.deleteAllUserRefreshTokens = async (user_id) => {
  const query = `
    DELETE FROM refresh_tokens 
    WHERE user_id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [user_id]);

  return result.rows;
};

/**
 * Clean up expired refresh tokens
 */
exports.cleanupExpiredTokens = async () => {
  const query = `
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW()
    RETURNING id
  `;

  const result = await pool.query(query);

  return result.rows;
};
