# Cool Wrld Account Architecture

> Authentication, authorization, and account management strategy.

---

## Overview

Cool Wrld uses a **two-system architecture** with **email-based linking**:

| System | Provider | Purpose |
|--------|----------|---------|
| **Community** | Clerk | MyMoments, RSVPs, Cool Points, Community |
| **Commerce** | Shopify | Store purchases, orders, shipping |

Same email = automatic linking for unified profile.

---

## Authentication Provider: Clerk

### Why Clerk?

| Factor | Decision |
|--------|----------|
| **Industry Standard** | Used by Disney, Notion, Linear, etc. |
| **Managed** | Security, compliance, sessions handled |
| **Social Login** | Google, Apple, Instagram |
| **Magic Links** | Passwordless email auth |
| **Components** | Pre-built UI (sign-in, profile, etc.) |
| **Free Tier** | Up to 10,000 MAU |
| **DX** | Excellent developer experience |

### Sign-in Options

| Method | UX | Recommended For |
|--------|-----|----------------|
| **Google** | 2 clicks | Fastest onboarding |
| **Apple** | 2 clicks | iOS users |
| **Email Magic Link** | Email + click | No account needed |
| **Email + Password** | Traditional | Fallback |

### Clerk Setup

```typescript
// Environment variables
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

// Middleware
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/rsvp/.*", "/moments/.*"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)"],
};
```

---

## Account Types

### Cool Wrld User

```typescript
interface CoolWrldUser {
  id: string;                    // Clerk user ID
  email: string;                 // Primary email
  phone?: string;                // Optional phone
  instagram_handle?: string;     // Linked Instagram
  
  // Auth
  auth_provider: "google" | "apple" | "email";
  
  // Linking
  linked_shopify_customer_id?: string;
  linked_at?: Date;
  
  // Profile
  avatar_url?: string;
  display_name?: string;
  
  // Cool Points
  cool_points_balance: number;
  
  // VIP (based on engagement + commerce)
  tier: "fan" | "supporter" | "loyal" | "vip";
  
  // Meta
  created_at: Date;
  last_active: Date;
}
```

### Shopify Customer (Existing)

```typescript
interface ShopifyCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  orders_count: number;
  total_spent: string;        // "150.00"
  created_at: Date;
  updated_at: Date;
  state: "enabled" | "disabled" | "invited" | "declined";
}
```

---

## Email-Based Linking

### The Process

```
1. User signs into Cool Wrld (Clerk)
       ↓
2. Clerk returns: { id, email: "john@..." }
       ↓
3. Query Shopify: GET /customers/search.json?query=email:john@...
       ↓
4. ┌─────────────────────────────────────┐
   │ IF Shopify customer found:            │
   │   → Link accounts                   │
   │   → Store shopify_customer_id       │
   │   → Set linked_at timestamp        │
   │   → Calculate VIP tier             │
   ├─────────────────────────────────────┤
   │ IF no Shopify customer:              │
   │   → Cool Wrld only account        │
   │   → No linking yet                │
   └─────────────────────────────────────┘
```

### Linking Implementation

```typescript
async function linkShopifyAccount(clerkUserId: string, email: string) {
  // Find Shopify customer by email
  const shopifyCustomer = await shopify.customer.list({
    query: `email:${email}`,
    limit: 1,
  });
  
  if (shopifyCustomer.length > 0) {
    // Link accounts
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        linked_shopify_customer_id: shopifyCustomer[0].id,
        linked_at: new Date().toISOString(),
        link_source: "auto",
      },
    });
    
    // Calculate VIP tier
    const tier = calculateTier(shopifyCustomer[0]);
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: { tier },
    });
    
    return { linked: true, customer: shopifyCustomer[0] };
  }
  
  return { linked: false };
}
```

### Unlinking

Users can unlink at any time:

```typescript
async function unlinkShopifyAccount(clerkUserId: string) {
  await clerk.users.updateUserMetadata(clerkUserId, {
    publicMetadata: {
      linked_shopify_customer_id: null,
      linked_at: null,
      link_source: null,
    },
  });
}
```

---

## VIP Tiers

### Tier Calculation

```typescript
interface TierThresholds {
  fan: { totalSpent: 0, engagement: 0 };
  supporter: { totalSpent: 50, engagement: 100 };
  loyal: { totalSpent: 150, engagement: 500 };
  vip: { totalSpent: 500, engagement: 1000 };
}

function calculateTier(shopifyCustomer: ShopifyCustomer): string {
  const totalSpent = parseFloat(shopifyCustomer.total_spent);
  
  if (totalSpent >= 500) return "vip";
  if (totalSpent >= 150) return "loyal";
  if (totalSpent >= 50) return "supporter";
  return "fan";
}
```

### Tier Benefits

| Tier | Total Spent | Benefits |
|------|-------------|----------|
| **Fan** | $0 | Basic access |
| **Supporter** | $50+ | 10% bonus points on purchases |
| **Loyal** | $150+ | Early access, exclusive content |
| **VIP** | $500+ | All above + special badge + meet & greet access |

---

## Unified Profile Query

### Get Full Profile

```typescript
async function getUnifiedProfile(email: string) {
  // Get Cool Wrld data from Clerk
  const coolWrldUser = await clerk.users.getUserByEmail(email);
  
  if (!coolWrldUser) {
    throw new Error("User not found in Cool Wrld");
  }
  
  // Get Shopify data
  const shopifyCustomer = await getShopifyCustomer(email);
  
  // Get Cool Points from D1
  const points = await getCoolPointsBalance(coolWrldUser.id);
  const pointsHistory = await getCoolPointsHistory(coolWrldUser.id);
  
  return {
    // Identity
    id: coolWrldUser.id,
    email: coolWrldUser.email,
    display_name: coolWrldUser.displayName,
    avatar_url: coolWrldUser.imageUrl,
    
    // Cool Wrld
    cool_points_balance: points,
    tier: coolWrldUser.publicMetadata.tier,
    member_since: coolWrldUser.createdAt,
    
    // Shopify (if linked)
    shopify: shopifyCustomer ? {
      customer_id: shopifyCustomer.id,
      total_spent: shopifyCustomer.total_spent,
      orders_count: shopifyCustomer.orders_count,
      linked: true,
    } : { linked: false },
    
    // Points history
    recent_points: pointsHistory.slice(0, 10),
  };
}
```

---

## Webhooks

### Clerk → Shopify Sync

```typescript
// POST /api/webhooks/clerk
export async function POST(req: Request) {
  const body = await req.json();
  const evt = body.data;
  
  switch (body.type) {
    case "user.created":
      // New user - check for Shopify link
      await linkShopifyAccount(evt.id, evt.email_addresses[0].email);
      break;
      
    case "user.updated":
      // Profile update
      break;
      
    case "user.deleted":
      // Clean up Cool Points, etc.
      await cleanupUser(evt.id);
      break;
  }
  
  return new Response("OK", { status: 200 });
}
```

---

## Privacy & Security

### Data Separation

| Data | Cool Wrld (Clerk) | Shopify |
|------|-------------------|---------|
| Email | ✅ | ✅ |
| Name | ✅ | ✅ |
| Phone | ✅ | ✅ |
| Avatar | ✅ | ❌ |
| Cool Points | ✅ | ❌ |
| RSVPs | ✅ | ❌ |
| Orders | ❌ | ✅ |
| Addresses | ❌ | ✅ |
| Payment | ❌ | ✅ |

### User Privacy

- Users can unlink at any time
- Purchase history visible only to user
- No payment data shared
- GDPR compliant (Clerk handles)
- Shopify handles PCI compliance

---

## Migration Path

### Existing Moments Users

Users who RSVPs'd with just email need to create accounts:

```typescript
async function migrateExistingRSVP(rsvp: GalleryRSVP) {
  // Check if Clerk user exists
  const existingUser = await clerk.users.getUserByEmail(rsvp.email);
  
  if (existingUser) {
    // Link to RSVP
    await linkRSVPToUser(existingUser.id, rsvp.id);
    return;
  }
  
  // Send invite to create account
  await sendAccountInviteEmail(rsvp.email, {
    rsvp_id: rsvp.id,
    event_name: rsvp.event_name,
  });
}
```

### Invite Email Template

> **You're on the list!**
> 
> Thanks for RSVPing to [Event Name].
> 
> Create your Cool Wrld account to access MyMoments and earn Cool Points.
> 
> [Create Account Button]
> 
> Already have an account? [Sign In]

---

## Implementation Checklist

### Phase 1: Clerk Setup
- [ ] Create Clerk account
- [ ] Configure application
- [ ] Add sign-in methods (Google, Apple, Email)
- [ ] Set up webhooks
- [ ] Configure middleware

### Phase 2: Linking
- [ ] Shopify API integration
- [ ] Email lookup on sign-in
- [ ] Auto-link logic
- [ ] Tier calculation
- [ ] Unlink functionality

### Phase 3: Profile
- [ ] Unified profile API
- [ ] Profile page with linked accounts
- [ ] VIP tier display
- [ ] Privacy settings

### Phase 4: Migration
- [ ] Existing RSVP audit
- [ ] Invite email flow
- [ ] Account creation wizard
- [ ] Link existing RSVPs

---

## File Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   └── api/
│       └── webhooks/
│           └── clerk/route.ts
│
├── lib/
│   ├── clerk.ts              # Clerk client
│   ├── shopify.ts            # Shopify client
│   ├── account-linking.ts    # Linking logic
│   └── unified-profile.ts    # Profile queries
│
└── components/
    ├── auth/
    │   ├── SignInButton.tsx
    │   ├── UserButton.tsx
    │   └── ProfileCard.tsx
    └── profile/
        ├── UnifiedProfile.tsx
        └── ShopLinkButton.tsx
```

---

## Dependencies

- `@clerk/nextjs` - Authentication
- `@shopify/shopify-api` - Shopify client
- Clerk account + application configured

---

**Version**: 1.0
**Created**: 2026-04-17
**Status**: Draft
