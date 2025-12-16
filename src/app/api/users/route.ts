
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { userSchema } from '../../../lib/validation';
import { 
  insertUser, 
  getUserByEmail, 
  updateUser, 
  deleteUser, 
  incrementFailedLoginAttempts, 
  resetFailedLoginAttempts, 
  isAccountLocked,
  generateEmailVerificationToken,
  verifyEmailToken,
  isEmailVerified
} from '../../../lib/db';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { getAuthTokenFromRequest, getJwtSecret } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { SignJWT, jwtVerify } from 'jose';

// Resend integration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@odubo.studio';
const getSecret = () => new TextEncoder().encode(getJwtSecret());

import { Resend } from 'resend';

// Validate email configuration
function validateEmailConfig() {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL is not configured');
  }
  if (!RESEND_FROM_EMAIL.includes('@')) {
    throw new Error('RESEND_FROM_EMAIL is not a valid email address');
  }
}

// Send password reset email using Resend SDK
async function sendResetEmail(email: string, token: string) {
  // Validate email configuration first
  validateEmailConfig();
  
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const subject = 'Reset your Odubo password';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #1f2937 0%, #dc2626 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 20px; }
        .button { display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #b91c1c; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 16px; margin: 20px 0; color: #92400e; }
        .link { color: #dc2626; text-decoration: none; }
        .link:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Reset Your Password</h1>
        </div>
        <div class="content">
          <h2 style="color: #1f2937; margin-top: 0;">Hello there!</h2>
          <p>We received a request to reset your password for your Odubo account. Click the button below to set a new password:</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset My Password</a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p><a href="${resetUrl}" class="link">${resetUrl}</a></p>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 30 minutes for your security. If you didn't request this password reset, you can safely ignore this email.
          </div>
          
          <p>Thanks,<br><strong>The Odubo Team</strong></p>
        </div>
        <div class="footer">
          <p>This email was sent from a notification-only address that cannot accept incoming email. Please do not reply to this message.</p>
          <p>&copy; 2025 Odubo Studio. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: `Odubo <${RESEND_FROM_EMAIL}>`,
      to: [email],
      subject,
      html,
    });
    console.log(`Password reset email sent successfully to ${email}`);
  } catch (err) {
    console.error('Failed to send reset email via Resend SDK:', err);
    throw new Error('Failed to send password reset email');
  }
}

// Send email verification email using Resend SDK
async function sendVerificationEmail(email: string, token: string) {
  // Validate email configuration first
  validateEmailConfig();
  
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const subject = 'Verify your Odubo email address';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #1f2937 0%, #dc2626 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 20px; }
        .button { display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #b91c1c; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        .info { background: #dbeafe; border: 1px solid #3b82f6; border-radius: 6px; padding: 16px; margin: 20px 0; color: #1e40af; }
        .link { color: #dc2626; text-decoration: none; }
        .link:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Verify Your Email</h1>
        </div>
        <div class="content">
          <h2 style="color: #1f2937; margin-top: 0;">Welcome to Odubo!</h2>
          <p>Thanks for signing up! To complete your account setup, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify My Email</a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p><a href="${verificationUrl}" class="link">${verificationUrl}</a></p>
          
          <div class="info">
            <strong>ℹ️ What happens next?</strong> Once verified, you'll have full access to your Odubo account including streaming history, recommendations, and order tracking.
          </div>
          
          <p>Thanks,<br><strong>The Odubo Team</strong></p>
        </div>
        <div class="footer">
          <p>This email was sent from a notification-only address that cannot accept incoming email. Please do not reply to this message.</p>
          <p>&copy; 2025 Odubo Studio. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  try {
    const resend = new Resend(RESEND_API_KEY);
    await resend.emails.send({
      from: `Odubo <${RESEND_FROM_EMAIL}>`,
      to: [email],
      subject,
      html,
    });
    console.log(`Verification email sent successfully to ${email}`);
  } catch (err) {
    console.error('Failed to send verification email via Resend SDK:', err);
    throw new Error('Failed to send verification email');
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { action: string; [key: string]: any };
  const { action, ...rest } = body;

  if (action === 'update-profile') {
    try {
      const token = getAuthTokenFromRequest(req);
      if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { payload: decoded } = await jwtVerify(token, getSecret());
      const { userId } = decoded as any;
      const { firstName, lastName } = rest;
      await updateUser(userId as string, { first_name: firstName, last_name: lastName });
      return NextResponse.json({ message: 'Profile updated successfully' });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
  }

  if (action === 'update-email') {
    // This is a placeholder for a more complex flow that would involve email verification
    try {
      const token = getAuthTokenFromRequest(req);
      if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { payload: decoded } = await jwtVerify(token, getSecret());
      const { userId } = decoded as any;
      const { email } = rest;
      await updateUser(userId as string, { email });
      return NextResponse.json({ message: 'Email updated successfully' });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to update email' }, { status: 500 });
    }
  }

  if (action === 'change-password') {
    try {
      const token = getAuthTokenFromRequest(req);
      if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { payload: decoded } = await jwtVerify(token, getSecret());
      const { userId, email } = decoded as any;
      const { currentPassword, newPassword } = rest;
      const user = await getUserByEmail(email);
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await updateUser(userId as string, { password_hash: hashedPassword });
      return NextResponse.json({ message: 'Password changed successfully' });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
    }
  }

  // --- Email Verification Flow ---
  if (action === 'verify-email') {
    try {
      const { email, token } = rest;
      if (!email || !token) {
        return NextResponse.json({ error: 'Email and token required' }, { status: 400 });
      }
      
      const isValid = await verifyEmailToken(email, token);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 });
      }
      
      return NextResponse.json({ message: 'Email verified successfully! You can now log in to your account.' });
    } catch (err: any) {
      console.error('Email verification error:', err);
      return NextResponse.json({ error: 'Email verification failed' }, { status: 500 });
    }
  }

  // --- Query Users (Admin/Testing) ---
  if (action === 'query-users') {
    try {
      const databaseUrl = process.env.DATABASE_URL;
      const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;
      
      if (!databaseUrl) {
        return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
      }
      
      if (!apiToken) {
        return NextResponse.json({ error: 'CLOUDFLARE_D1_API_TOKEN not configured' }, { status: 500 });
      }

      const response = await fetch(`${databaseUrl}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: 'SELECT id, email, username, first_name, last_name, email_verified, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 10'
        })
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string; [key: string]: any };
        return NextResponse.json({ error: 'Database query failed', details: data }, { status: 500 });
      }

      const data = await response.json() as { result?: Array<{ results: any[] }>; [key: string]: any };
      return NextResponse.json({ users: data.result?.[0]?.results || [], success: true });
    } catch (err: any) {
      console.error('Query users error:', err);
      return NextResponse.json({ error: 'Failed to query users' }, { status: 500 });
    }
  }

  // --- Delete User (for testing) ---
  if (action === 'delete-user') {
    try {
      const { email } = rest;
      if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }
      
      // Get user by email
      const user = await getUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Actually delete the user
      await deleteUser(user.id);
      
      return NextResponse.json({ 
        message: 'User deleted successfully',
        user: { id: user.id, email: user.email }
      });
    } catch (err: any) {
      console.error('Delete user error:', err);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
  }

  // --- Resend Verification Email Flow ---
  if (action === 'resend-verification') {
    try {
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const rl = await rateLimit({ key: `resend-verification:${ip}`, limit: 3, windowMs: 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      
      const { email } = rest;
      if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }
      
      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return NextResponse.json({ message: 'If that email exists, a verification link has been sent.' });
      }
      
      // Check if already verified
      if (await isEmailVerified(email)) {
        return NextResponse.json({ message: 'Email is already verified.' });
      }
      
      // Generate and send new verification email
      try {
        const { token } = await generateEmailVerificationToken(email);
        await sendVerificationEmail(email, token);
        return NextResponse.json({ message: 'If that email exists, a verification link has been sent.' });
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return NextResponse.json({ error: 'Failed to send verification email. Please try again later.' }, { status: 500 });
      }
    } catch (err: any) {
      console.error('Resend verification error:', err);
      return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
    }
  }

  // --- Forgot Password Flow ---
  if (action === 'forgot-password') {
    try {
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const rl = await rateLimit({ key: `forgot:${ip}`, limit: 5, windowMs: 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      
      const { email } = rest;
      if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }
      
      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
      }
      
      const resetToken = (function genHex(bytes: number) {
        const arr = new Uint8Array(bytes);
        globalThis.crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      })(32);
      const resetTokenHash = await bcrypt.hash(resetToken, 10);
      const resetTokenExpiry = Date.now() + 1000 * 60 * 30; // 30 min expiry

      // Update user with reset token
      await updateUser(user.id, { 
        reset_token_hash: resetTokenHash, 
        reset_token_expiry: resetTokenExpiry 
      });

      // Send reset email
      try {
        await sendResetEmail(email, resetToken);
        return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
      } catch (emailError) {
        // If email fails, remove the reset token to prevent account lockout
        await updateUser(user.id, { 
          reset_token_hash: null, 
          reset_token_expiry: null 
        });
        console.error('Email sending failed, removed reset token:', emailError);
        return NextResponse.json({ error: 'Failed to send reset email. Please try again later.' }, { status: 500 });
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      return NextResponse.json({ error: 'Failed to process password reset request' }, { status: 500 });
    }
  }

  // --- Reset Password Flow ---
  if (action === 'reset-password') {
    try {
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const rl = await rateLimit({ key: `reset:${ip}`, limit: 10, windowMs: 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      const { email, token, newPassword } = rest;
      if (!email || !token || !newPassword) {
        return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      }
      const user = await getUserByEmail(email);
      if (!user || !user.reset_token_hash || !user.reset_token_expiry) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
      }
      if (Date.now() > Number(user.reset_token_expiry)) {
        return NextResponse.json({ error: 'Token expired' }, { status: 400 });
      }
      const valid = await bcrypt.compare(token, user.reset_token_hash);
      if (!valid) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await updateUser(user.id, { password_hash: hashedPassword, reset_token_hash: null, reset_token_expiry: null });
      return NextResponse.json({ message: 'Password reset successful' });
    } catch (err: any) {
      console.error('Reset password error:', err);
      return NextResponse.json({ error: 'Password reset failed' }, { status: 500 });
    }
  }

  // Login
  if (action === 'login') {
    try {
      const ip = req.headers.get('x-forwarded-for') || 'unknown';
      const rl = await rateLimit({ key: `login:${ip}`, limit: 10, windowMs: 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      
      const { email, password } = rest;
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }

      // Check if account is locked
      const lockoutStatus = await isAccountLocked(email);
      if (lockoutStatus.isLocked) {
        const lockoutTime = new Date(lockoutStatus.lockoutExpiry!);
        const remainingMinutes = Math.ceil((lockoutTime.getTime() - Date.now()) / (1000 * 60));
        return NextResponse.json({ 
          error: `Account temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minutes.` 
        }, { status: 423 }); // 423 = Locked
      }

      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Check if email is verified (skip for admin users)
      if (!user.email_verified && !user.is_admin) {
        return NextResponse.json({ 
          error: 'Please verify your email address before logging in. Check your inbox for a verification link.',
          requiresVerification: true 
        }, { status: 401 });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        // Increment failed login attempts and check if account should be locked
        const lockoutResult = await incrementFailedLoginAttempts(email);
        
        if (lockoutResult.isLocked) {
          return NextResponse.json({ 
            error: 'Account locked due to multiple failed login attempts. Try again in 15 minutes.' 
          }, { status: 423 });
        }
        
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }

      // Successful login - reset failed attempts
      await resetFailedLoginAttempts(email);

      // Automatically link to Shopify customer if not already linked
      if (!user.shopify_customer_id) {
        try {
          const linkResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/shopify/auto-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
          });
          
          if (linkResponse.ok) {
            const linkResult = await linkResponse.json() as { linked: boolean; shopify_customer_id?: string };
            console.log('Shopify auto-link on login:', linkResult);
            // Update user object with new Shopify data
            if (linkResult.linked && linkResult.shopify_customer_id) {
              user.shopify_customer_id = linkResult.shopify_customer_id;
            }
          }
        } catch (linkError) {
          console.error('Shopify auto-link on login failed:', linkError);
          // Don't fail login if Shopify linking fails
        }
      }

      const secret = getSecret();
      const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        is_admin: user.is_admin || false,
        firstName: user.first_name,
        lastName: user.last_name,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);
      
      const res = NextResponse.json({ 
        message: 'Login successful', 
        token, 
        is_admin: user.is_admin || false 
      });
      
      try {
        // Also set httpOnly cookie for server-side auth (clients can migrate off localStorage gradually)
        res.cookies.set('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
      } catch {}
      
      return res;
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = (err?.message || '').toString();
      // Surface common misconfigurations with clearer messages
      if (msg.includes('DATABASE_URL environment variable is not set')) {
        return NextResponse.json(
          { error: 'Server misconfigured: DATABASE_URL is not set' },
          { status: 500 }
        );
      }
      if (msg.includes('CLOUDFLARE_D1_API_TOKEN environment variable is not set')) {
        return NextResponse.json(
          { error: 'Server misconfigured: CLOUDFLARE_D1_API_TOKEN is not set' },
          { status: 500 }
        );
      }
      if (msg.includes('D1 /query non-JSON response')) {
        return NextResponse.json(
          { error: 'Database connection failed: check DATABASE_URL and Cloudflare credentials' },
          { status: 502 }
        );
      }
      return NextResponse.json({ error: 'Login failed' }, { status: 400 });
    }
  }

  // Signup
  if (action === 'signup') {
    try {
      console.log('Signup attempt with data:', rest);
      console.log('Validation schema:', userSchema);
      console.log('Attempting to parse with schema...');
      const user = userSchema.parse(rest);
      console.log('Validation passed, user data:', user);
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const id = uuidv4();
      
      // Only check ADMIN_EMAILS env var - ignore any is_admin flag in body for security
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim().toLowerCase()) || [];
      const is_admin = adminEmails.includes(user.email.toLowerCase());
      
      console.log(`User ${user.email} admin status: ${is_admin} (admin emails: ${adminEmails.join(', ')})`);
      
      // Create user account with role 'viewer' by default (admins get 'admin' via ADMIN_EMAILS or invites)
      await insertUser({
        id,
        email: user.email,
        username: user.username,
        password_hash: hashedPassword,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin,
      });
      
      // Set default role to 'viewer' for regular signups
      if (!is_admin) {
        await updateUser(id, { role: 'viewer' as any });
      } else {
        await updateUser(id, { role: 'admin' as any });
      }
      
      // Automatically link to Shopify customer if exists
      let shopifyLinkResult = null;
      try {
        const linkResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/shopify/auto-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email })
        });
        
        if (linkResponse.ok) {
          shopifyLinkResult = await linkResponse.json();
          console.log('Shopify auto-link result:', shopifyLinkResult);
        }
      } catch (linkError) {
        console.error('Shopify auto-link failed:', linkError);
        // Don't fail signup if Shopify linking fails
      }
      
      // Generate and send verification email
      try {
        const { token } = await generateEmailVerificationToken(user.email);
        await sendVerificationEmail(user.email, token);
        
        return NextResponse.json({ 
          message: 'Account created successfully! Please check your email to verify your account.',
          user: { 
            id, 
            email: user.email, 
            username: user.username, 
            first_name: user.first_name, 
            last_name: user.last_name, 
            is_admin 
          }
        }, { status: 201 });
      } catch (emailError) {
        // If email fails, still create the account but inform user
        console.error('Failed to send verification email:', emailError);
        return NextResponse.json({ 
          message: 'Account created but verification email failed to send. Please contact support.',
          user: { 
            id, 
            email: user.email, 
            username: user.username, 
            first_name: user.first_name, 
            last_name: user.last_name, 
            is_admin 
          }
        }, { status: 201 });
      }
    } catch (err: any) {
      console.error('Signup validation error:', err);
      console.error('Error details:', err.errors);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      return NextResponse.json({ error: 'Invalid input', details: err.errors }, { status: 400 });
    }
  }

  // Update user (admin only)
  if (action === 'update-user') {
    try {
      const { userId, updates } = body as any;
      
      if (!userId || !updates) {
        return NextResponse.json({ error: 'User ID and updates required' }, { status: 400 });
      }

      // For now, allow any updates (you can add admin check here later)
      await updateUser(userId, updates);
      
      return NextResponse.json({ 
        message: 'User updated successfully',
        userId,
        updates
      });
    } catch (err: any) {
      console.error('Update user error:', err);
      return NextResponse.json({ error: 'Failed to update user', details: err.message }, { status: 500 });
    }
  }

  // Promote user to admin (workaround for D1 UPDATE limitation)
  if (action === 'promote-to-admin') {
    try {
      const { email } = body as any;
      
      if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }

      // Get the user first
      const user = await getUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Create a new admin user with unique email and username
      const adminId = uuidv4();
      const adminUser = {
        id: adminId,
        email: 'admin.' + user.email, // Make email unique
        username: user.username + '_admin',
        password_hash: user.password_hash, // Keep same password
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: true,
      };

      await insertUser(adminUser);
      
      return NextResponse.json({ 
        message: 'Admin account created successfully',
        adminUser: { 
          id: adminId, 
          email: user.email, 
          username: adminUser.username,
          is_admin: true 
        }
      });
    } catch (err: any) {
      console.error('Promote to admin error:', err);
      return NextResponse.json({ error: 'Failed to promote user', details: err.message }, { status: 500 });
    }
  }

  // Create admin account directly (bypasses email verification)
  if (action === 'create-admin') {
    try {
      const { email, username, password, first_name, last_name } = body as any;
      
      if (!email || !username || !password) {
        return NextResponse.json({ error: 'Email, username, and password required' }, { status: 400 });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const id = uuidv4();
      
      // Create admin user with email verification bypassed
      const adminUser = {
        id,
        email,
        username,
        password_hash: hashedPassword,
        first_name: first_name || 'Admin',
        last_name: last_name || 'User',
        is_admin: true,
        email_verified: true, // Bypass verification
      };

      await insertUser(adminUser);
      
      return NextResponse.json({ 
        message: 'Admin account created successfully with email verification bypassed',
        adminUser: { 
          id, 
          email, 
          username,
          is_admin: true,
          email_verified: true
        }
      });
    } catch (err: any) {
      console.error('Create admin error:', err);
      return NextResponse.json({ error: 'Failed to create admin', details: err.message }, { status: 500 });
    }
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { payload: decoded } = await jwtVerify(token, getSecret());
    const { userId } = decoded as any;
    await deleteUser(userId);
    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  
  if (action === 'email-status') {
    try {
      validateEmailConfig();
      return NextResponse.json({ 
        status: 'configured',
        service: 'resend',
        fromEmail: RESEND_FROM_EMAIL,
        hasApiKey: !!RESEND_API_KEY
      });
    } catch (error: any) {
      return NextResponse.json({ 
        status: 'error',
        error: error.message,
        service: 'resend',
        fromEmail: RESEND_FROM_EMAIL,
        hasApiKey: !!RESEND_API_KEY
      }, { status: 500 });
    }
  }
  
  return NextResponse.json({ message: 'Users endpoint placeholder' });
}

