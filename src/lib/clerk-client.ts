import { createClerkClient } from '@clerk/backend';

export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export function getClerkAuth() {
  return clerkClient;
}
