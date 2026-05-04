import { auth, currentUser } from '@clerk/nextjs/server';

export interface CoolWrldUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  publicMetadata: Record<string, any>;
}

export async function getCurrentUser(): Promise<CoolWrldUser | null> {
  const user = await currentUser();
  
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress || '',
    firstName: user.firstName || undefined,
    lastName: user.lastName || undefined,
    imageUrl: user.imageUrl || undefined,
    publicMetadata: user.publicMetadata as Record<string, any> || {},
  };
}

export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function requireUser(): Promise<CoolWrldUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

export async function getUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.email || null;
}

export function getShopifyCustomerId(user: CoolWrldUser): string | null {
  return user.publicMetadata?.shopify_customer_id || null;
}

export function isLinkedToShopify(user: CoolWrldUser): boolean {
  return !!user.publicMetadata?.shopify_customer_id;
}
