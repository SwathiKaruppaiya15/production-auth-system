const pool = require("../config/db");

/*
Create a new user in database
*/
exports.createUser = async ({ id, email, password }) => {
  const query = `
    INSERT INTO users (id, email, password)
    VALUES ($1, $2, $3)
    RETURNING id, email, role, created_at
  `;

  const values = [id, email, password];

  const result = await pool.query(query, values);

  return result.rows[0];
};

/*
Find user by email
*/
exports.findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return result.rows[0];
};

/*
Increment failed login attempts
*/
exports.incrementFailedAttempts = async (email) => {
  const query = `
    UPDATE users 
    SET failed_attempts = failed_attempts + 1,
        locked_until = CASE 
          WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
          ELSE locked_until 
        END
    WHERE email = $1
    RETURNING failed_attempts, locked_until
  `;

  const result = await pool.query(query, [email]);
  return result.rows[0];
};

/*
Reset failed login attempts on successful login
*/
exports.resetFailedAttempts = async (email) => {
  const query = `
    UPDATE users 
    SET failed_attempts = 0,
        locked_until = NULL
    WHERE email = $1
    RETURNING failed_attempts, locked_until
  `;

  const result = await pool.query(query, [email]);
  return result.rows[0];
};

/*
Check if account is locked
*/
exports.isAccountLocked = async (email) => {
  const result = await pool.query(
    "SELECT locked_until FROM users WHERE email = $1",
    [email]
  );

  const user = result.rows[0];
  if (!user) return false;

  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    return true;
  }

  return false;
};

/*
Find user by ID
*/
exports.findById = async (id) => {
  const result = await pool.query(
    "SELECT id, email, role, created_at FROM users WHERE id = $1",
    [id]
  );

  return result.rows[0];
};

/*
Get all users (admin only)
*/
exports.getAllUsers = async () => {
  const result = await pool.query(
    "SELECT id, email, role, created_at, failed_attempts, locked_until FROM users ORDER BY created_at DESC"
  );

  return result.rows;
};

/*
Update user role (admin only)
*/
exports.updateUserRole = async (id, newRole) => {
  const validRoles = ['user', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new Error('Invalid role');
  }

  const query = `
    UPDATE users 
    SET role = $2
    WHERE id = $1
    RETURNING id, email, role, updated_at
  `;

  const result = await pool.query(query, [id, newRole]);
  return result.rows[0];
};

/*
Delete user (admin only)
*/
exports.deleteUser = async (id) => {
  const query = `
    DELETE FROM users 
    WHERE id = $1
    RETURNING id, email
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0];
};

/*
Store email verification token
*/
exports.setVerificationToken = async (email, hashedToken, expiresAt) => {
  const query = `
    UPDATE users 
    SET verification_token = $2, 
        verification_expires_at = $3
    WHERE email = $1
    RETURNING id, email
  `;

  const result = await pool.query(query, [email, hashedToken, expiresAt]);
  return result.rows[0];
};

/*
Verify email using token
*/
exports.verifyEmail = async (hashedToken) => {
  const query = `
    UPDATE users 
    SET is_verified = true,
        verification_token = NULL,
        verification_expires_at = NULL
    WHERE verification_token = $1 
      AND verification_expires_at > NOW()
    RETURNING id, email, is_verified
  `;

  const result = await pool.query(query, [hashedToken]);
  return result.rows[0];
};

/*
Store password reset token
*/
exports.setPasswordResetToken = async (email, hashedToken, expiresAt) => {
  const query = `
    UPDATE users 
    SET reset_token = $2, 
        reset_token_expires_at = $3
    WHERE email = $1
    RETURNING id, email
  `;

  const result = await pool.query(query, [email, hashedToken, expiresAt]);
  return result.rows[0];
};

/*
Find user by password reset token
*/
exports.findByResetToken = async (hashedToken) => {
  const query = `
    SELECT id, email, reset_token_expires_at 
    FROM users 
    WHERE reset_token = $1 
      AND reset_token_expires_at > NOW()
  `;

  const result = await pool.query(query, [hashedToken]);
  return result.rows[0];
};

/*
Update password and clear reset token
*/
exports.updatePasswordAndClearResetToken = async (userId, hashedPassword) => {
  const query = `
    UPDATE users 
    SET password = $2,
        reset_token = NULL,
        reset_token_expires_at = NULL
    WHERE id = $1
    RETURNING id, email
  `;

  const result = await pool.query(query, [userId, hashedPassword]);
  return result.rows[0];
};

/*
Find user by verification token
*/
exports.findByVerificationToken = async (hashedToken) => {
  const query = `
    SELECT id, email, verification_expires_at 
    FROM users 
    WHERE verification_token = $1 
      AND verification_expires_at > NOW()
  `;

  const result = await pool.query(query, [hashedToken]);
  return result.rows[0];
};