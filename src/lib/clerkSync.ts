import { auth } from '@clerk/nextjs/server';
import { getUserByEmail, updateUser, executeQuery, User } from '@/lib/db';

export type ClerkUserBasic = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
};

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!databaseUrl || !apiToken) {
    console.error('[ClerkSync] Missing DATABASE_URL or API_TOKEN');
    return null;
  }

  const sql = 'SELECT * FROM users WHERE clerk_id = ? LIMIT 1';
  const params = [clerkId];

  try {
    const response = await fetch(`${databaseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ sql, params }),
    });

    const data = await response.json() as {
      result?: { results?: any[] }[];
      success?: boolean;
    };

    if (!response.ok || !data.result || !data.result.length || !data.result[0].results || !data.result[0].results.length) {
      return null;
    }

    const row = data.result[0].results[0];
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      password_hash: row.password_hash,
      first_name: row.first_name,
      last_name: row.last_name,
      is_admin: row.is_admin === 1 || row.is_admin === true,
    } as User;
  } catch (err) {
    console.error('[ClerkSync] getUserByClerkId error:', err);
    return null;
  }
}

function isEmailInAdminList(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export async function isUserAdmin(dbUser: User | null, email: string): boolean {
  if (dbUser?.is_admin === true) return true;
  if (isEmailInAdminList(email)) return true;
  return false;
}

export async function upsertClerkUser(clerkUser: {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}): Promise<{ user: User | null; isNew: boolean }> {
  const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
  if (!primaryEmail) {
    console.error('[ClerkSync] No email found for Clerk user:', clerkUser.id);
    return { user: null, isNew: false };
  }

  let user = await getUserByClerkId(clerkUser.id);

  if (!user) {
    user = await getUserByEmail(primaryEmail);
  }

  if (user) {
    const updates: Partial<any> = {
      clerk_id: clerkUser.id,
      first_name: clerkUser.firstName || undefined,
      last_name: clerkUser.lastName || undefined,
    };
    if (!user.first_name && clerkUser.firstName) updates.first_name = clerkUser.firstName;
    if (!user.last_name && clerkUser.lastName) updates.last_name = clerkUser.lastName;

    if (!user.clerk_id !== clerkUser.id) {
      await updateUser(user.id, { clerk_id: clerkUser.id });
    }
    return { user: { ...user, clerk_id: clerkUser.id }, isNew: false };
  }

  const databaseUrl = process.env.DATABASE_URL;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

  if (!databaseUrl || !apiToken) {
    const newId = crypto.randomUUID();
    const username = primaryEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + newId.slice(0, 8);

    const isAdmin = isEmailInAdminList(primaryEmail) ? 1 : 0;

    try {
      const sql = `INSERT INTO users (
        id, email, username, password_hash, first_name, last_name, is_admin, email_verified, is_active, subscription_tier, clerk_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 'free', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;

      const params = [
        newId,
        primaryEmail,
        username,
        `clerk_generated_${newId}`,
        clerkUser.firstName || '',
        clerkUser.lastName || '',
        isAdmin,
        clerkUser.id,
      ];

      await executeQuery(sql, params);

      const newUser = await getUserByClerkId(clerkUser.id);
      return { user: newUser, isNew: true };
    } catch (err) {
      console.error('[ClerkSync] Failed to create user:', err);
    }
  }

  return { user: null, isNew: false };
}

export async function getCurrentAuthUser(): Promise<{
  userId: string | null;
  email: string | null;
  dbUser: User | null;
  isAdmin: boolean;
}> {
  const authResult = await auth();
  const clerkUserId = authResult.userId;

  if (!clerkUserId) {
    return { userId: null, email: null, dbUser: null, isAdmin: false };
  }

  let dbUser = await getUserByClerkId(clerkUserId);

  if (!dbUser) {
    const { user: user } = authResult;
    if (user) {
      const upsertResult = await upsertClerkUser(user as any);
      dbUser = upsertResult.user;
    }
  }

  const email = dbUser?.email || (() => {
    const { user } = authResult;
    return user?.emailAddresses?.[0]?.emailAddress || null;
  })();

  const isAdmin = email ? await isUserAdmin(dbUser, email) : false;

  return {
    userId: clerkUserId,
    email,
    dbUser,
    isAdmin,
  };
}
