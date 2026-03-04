-- Database Indexing for Performance
-- These indexes improve query performance for authentication operations

-- Index for email lookups (login, signup, password reset)
-- Improves: WHERE email = $1 queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);

-- Index for refresh token user lookups (token refresh, logout)
-- Improves: WHERE user_id = $1 queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Index for refresh token expiration cleanup
-- Improves: WHERE expires_at < NOW() queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Composite index for verification token lookups
-- Improves: WHERE verification_token = $1 AND verification_expires_at > NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_verification_token_expires ON users(verification_token, verification_expires_at);

-- Composite index for password reset token lookups
-- Improves: WHERE reset_token = $1 AND reset_token_expires_at > NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_reset_token_expires ON users(reset_token, reset_token_expires_at);

-- Index for failed attempts and lock status
-- Improves: WHERE failed_attempts >= 5 OR locked_until > NOW()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_security ON users(failed_attempts, locked_until);

-- Index for user creation time (admin dashboard)
-- Improves: ORDER BY created_at DESC queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Note: CONCURRENTLY allows index creation without locking tables
-- Safe for production use
