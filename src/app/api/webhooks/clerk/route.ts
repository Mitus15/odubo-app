// Clerk has been removed in favor of JWT-based auth
// This webhook endpoint is no longer needed

export async function POST() {
  return new Response('Clerk webhooks are disabled (JWT-based auth in use)', { status: 200 });
}
