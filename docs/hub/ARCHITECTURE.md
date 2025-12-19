# The Hub - Architecture Documentation

## Overview

The Hub is an enterprise-grade, mobile-first business operating system built as a parallel admin system at `/admin-v2`. It provides role-based access control (RBAC), a modern responsive UI, and modular architecture designed for a fashion/entertainment company with 5-10 team members.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15+ (App Router) |
| Runtime | React 19, TypeScript |
| Styling | Tailwind CSS 4 + CSS Custom Properties |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Video | Cloudflare Stream |
| Commerce | Shopify Storefront API |
| Auth | JWT with RBAC |

## Directory Structure

```
src/
├── app/
│   └── admin-v2/                    # The Hub application
│       ├── layout.tsx               # Root layout with auth
│       ├── page.tsx                 # Dashboard
│       ├── hub-tokens.css           # Design system tokens
│       ├── loading.tsx              # Loading state
│       ├── error.tsx                # Error boundary
│       ├── content/                 # Content Hub module
│       │   ├── page.tsx             # Content overview
│       │   ├── videos/page.tsx      # Video library
│       │   ├── clips/page.tsx       # Clips manager
│       │   ├── music/page.tsx       # Music library
│       │   └── moments/page.tsx     # Event galleries
│       └── settings/                # Settings module
│           ├── page.tsx             # Settings overview
│           └── team/page.tsx        # Team & roles
│
├── components/
│   └── hub/                         # Hub-specific components
│       ├── layout/
│       │   ├── HubShell.tsx         # Main app shell
│       │   ├── HubNavigation.tsx    # Navigation (bottom + sidebar)
│       │   └── HubHeader.tsx        # Module header
│       └── data-display/
│           └── DataTable.tsx        # Responsive table component
│
├── contexts/
│   └── HubUserContext.tsx           # Auth state & permissions
│
├── lib/
│   └── hub/
│       ├── types.ts                 # TypeScript definitions
│       ├── permissions.ts           # RBAC logic
│       └── middleware.ts            # API middleware
│
└── app/api/v2/                      # Hub API routes
    └── auth/
        ├── me/route.ts              # Current user endpoint
        └── roles/route.ts           # Role management

database/
└── migrations/
    └── 050_hub_rbac_system.sql      # RBAC schema
```

## Core Systems

### 1. Role-Based Access Control (RBAC)

The RBAC system uses three database tables:

**`role_definitions`** - Defines available roles:
- `slug` (PK): Unique identifier (e.g., 'admin', 'content_editor')
- `name`: Display name
- `default_modules`: JSON array of accessible modules
- `default_permissions`: JSON object of permissions per module
- `is_system`: Prevents deletion of core roles
- `color`, `icon`: UI customization

**`user_roles`** - Assigns roles to users:
- `user_id`: Reference to users table
- `role_slug`: Reference to role_definitions
- `module_overrides`: Optional JSON to customize access
- `permission_overrides`: Optional JSON to customize permissions
- `expires_at`: Optional role expiration

**`permission_audit_log`** - Tracks permission changes for security

#### Permission Types

```typescript
type Permission = 'read' | 'write' | 'delete' | 'admin' | 'approve' | 'export';
type Module = 'content' | 'social' | 'commerce' | 'analytics' |
              'communications' | 'projects' | 'events' | 'system' |
              'reports' | 'marketing';
```

#### Permission Resolution

1. Fetch all roles assigned to user
2. Merge permissions from all roles (union)
3. Apply any role-specific overrides
4. Check `is_admin` flag for legacy support
5. Cache resolved permissions

### 2. Authentication Flow

```
┌──────────────┐      ┌────────────────┐      ┌──────────────┐
│   Browser    │──────│  /api/v2/auth  │──────│    D1 DB     │
│              │      │     /me        │      │              │
│  JWT Token   │      │                │      │  users       │
│  (localStorage)     │  Decode JWT    │      │  user_roles  │
│              │      │  Resolve perms │      │  roles       │
└──────────────┘      └────────────────┘      └──────────────┘
```

1. User logs in via `/admin/login`
2. JWT stored in localStorage
3. HubUserContext fetches `/api/v2/auth/me` on mount
4. API decodes JWT, resolves permissions, returns user object
5. Context provides `canAccess()` and `hasModule()` helpers

### 3. Navigation Architecture

**Mobile (< 768px)**:
- Bottom navigation bar with 4 primary modules + "More"
- Slide-out sidebar from hamburger menu
- Touch targets minimum 44px

**Desktop (>= 768px)**:
- Fixed left sidebar
- Collapsible for more screen space
- Module icons with labels

Navigation items are filtered by `hasModule()` to show only accessible modules.

### 4. Component Architecture

**HubShell** (`src/components/hub/layout/HubShell.tsx`)
- Wraps entire application
- Manages sidebar state
- Handles responsive breakpoints
- Shows loading skeleton during auth

**HubNavigation** (`src/components/hub/layout/HubNavigation.tsx`)
- Renders both sidebar and bottom nav variants
- Uses `hasModule()` for filtering
- Handles active state based on pathname
- Includes overflow menu for mobile

**DataTable** (`src/components/hub/data-display/DataTable.tsx`)
- Responsive table/card hybrid
- Mobile: Card layout with swipe actions
- Desktop: Traditional table with sorting
- Supports row selection, actions, pagination

### 5. Design System

CSS custom properties defined in `hub-tokens.css`:

```css
:root {
  /* Colors */
  --hub-bg-primary: #171616;
  --hub-bg-secondary: #1f1e1d;
  --hub-bg-tertiary: #302927;
  --hub-text-primary: #ede8df;
  --hub-text-secondary: #b2a491;
  --hub-text-muted: #726d6c;
  --hub-accent: #843c2d;
  --hub-accent-hover: #b85d47;

  /* Layout */
  --hub-touch-target: 44px;
  --hub-sidebar-width: 260px;
  --hub-bottom-nav-height: 64px;

  /* Effects */
  --hub-glass-blur: 12px;
}
```

Component classes:
- `.hub-card` - Card container with border and hover states
- `.hub-btn` - Button base with variants (primary, secondary)
- `.hub-input` - Form input styling
- `.hub-badge` - Status badges with color variants

## API Design

### Endpoint Pattern

```
/api/v2/{module}/{resource}
```

### Response Format

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }

// List with pagination
{ success: true, data: T[], total: number, page: number, pageSize: number }
```

### Middleware Helpers

```typescript
// Require authenticated user
const user = await requireAuth(request);

// Require specific permission
await requirePermission(request, 'content', 'write');

// Admin-only endpoint
await requireAdmin(request);

// Parse and validate body
const body = await parseBody(request, schema);
```

## Security Considerations

1. **JWT Validation**: All API routes validate JWT signature
2. **Permission Checks**: Every mutation checks user permissions
3. **Audit Logging**: Permission changes are logged
4. **Rate Limiting**: API endpoints have rate limits
5. **Input Validation**: Zod schemas validate all inputs
6. **XSS Prevention**: React escapes output by default
7. **CSRF**: JWT in headers prevents CSRF

## Future Modules

### Phase 2: Social CMS & Commerce
- Distribution queue
- Post composer
- Shopify integration
- Inventory management

### Phase 3: Analytics & Events
- Performance dashboards
- Event lifecycle management
- Live check-in system

### Phase 4: Communications & Projects
- Support tickets
- Team messaging
- Project management

### Phase 5: Integrations
- QuickBooks/Xero
- Email marketing
- Shipping carriers

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3s |
| API Response | < 500ms |

## Development Guidelines

### Adding a New Module

1. Create pages in `/admin-v2/{module}/`
2. Add module to navigation in `HubNavigation.tsx`
3. Add module permissions to `types.ts`
4. Create API routes in `/api/v2/{module}/`
5. Add permission checks to API routes

### Adding a New Role

1. Insert into `role_definitions` table
2. Define `default_modules` and `default_permissions`
3. Role will automatically appear in Team settings

### Creating API Endpoints

```typescript
import { requirePermission, success, parseBody } from '@/lib/hub/middleware';

export async function POST(request: Request) {
  const user = await requirePermission(request, 'content', 'write');
  const body = await parseBody(request, CreateSchema);

  // ... business logic

  return success({ id: newId });
}
```

## Deployment

The Hub deploys with the main application on Cloudflare Pages.

1. Database migrations run manually via wrangler
2. Environment variables set in Cloudflare dashboard
3. Preview deployments available for testing
