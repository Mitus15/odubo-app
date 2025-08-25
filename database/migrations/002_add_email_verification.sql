-- Migration: Add email verification fields to users table
-- Date: 2025-01-15
-- Purpose: Security hardening - implement email verification on signup

-- Add email verification fields to users table
ALTER TABLE users ADD COLUMN email_verification_token TEXT;
ALTER TABLE users ADD COLUMN email_verification_expiry DATETIME;
ALTER TABLE users ADD COLUMN email_verified_at DATETIME;

-- Create index for efficient verification checking
CREATE INDEX IF NOT EXISTS idx_users_email_verification ON users(email_verification_token, email_verification_expiry);

-- Add comment for documentation
-- email_verification_token: Token sent to user's email for verification
-- email_verification_expiry: Timestamp when verification token expires (24 hours)
-- email_verified_at: Timestamp when email was verified (NULL if not verified)
