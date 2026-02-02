# Copilot Instructions for Odubo

Multimedia artist platform (clips feed, store, music, moments/galleries) built with Next.js 15+ App Router, React 19, and Cloudflare infrastructure.

## Commands

```bash
# Development
npm run dev                    # Start dev server with Turbopack
npm run build                  # Production build (skips lint)
npm run lint                   # ESLint check

# Testing
npm test                       # Run all tests
npm test -- --testPathPattern="filename"     # Run single test file
npm test -- -t "test name"                   # Run specific test by name
npm run test:coverage          # Coverage report (70% threshold)

# Database (Cloudflare D1)
npx wrangler d1 execute odubo --remote --file=database/migrations/xxx.sql
npx wrangler d1 execute odubo --local --command="SELECT * FROM ..."

# Scripts (pattern for running TypeScript)
tsx --env-file=.env.local scripts/<script-name>.ts
```

## Architecture

### Stack
- **Framework**: Next.js 15+ (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Framer Motion
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Video**: Cloudflare Stream + HLS.js
- **Commerce**: Shopify Storefront API (headless)
- **Auth**: Custom (bcrypt + JWT)
- **Deployment**: Vercel (auto-deploys on push to main)

### Key Patterns

**Single Source of Truth**: Each domain has one authoritative controller. `ClipCard` owns all video playback—`ClipsFeed` only manages which clip is active.

**Context-Based State**: Global state (audio, auth, cart) lives in React contexts. Components consume via hooks. Storage syncs to localStorage.

**Headless Commerce**: Shopify provides product data and checkout. Cart state is local until checkout redirect.

**Edge-First**: Cloudflare D1/R2/Stream for data, assets, and video. API routes run on edge.

**Subdomain Routing**: Middleware handles `admin.odubo.studio` → Admin dashboard.

### Directory Layout
```
src/
├── app/           # Next.js App Router pages + API routes
├── components/    # React components (clips/, store/, ui/)
├── contexts/      # React contexts (AudioContext, CartContext)
├── lib/           # Utilities (db.ts, shopify.ts, hlsPlayer.ts)
├── types/         # TypeScript definitions
└── middleware.ts  # Subdomain routing

database/
├── migrations/    # SQL migrations (numbered: 001_xxx.sql)
└── schema.sql     # Full schema reference
```

### API Routes (`/src/app/api/`)
- `/api/clips/` — Clip CRUD and engagement
- `/api/shopify/` — Product data, checkout, webhooks
- `/api/moments/` — Galleries, events, RSVPs
- `/api/admin/` — Admin-only operations
- `/api/stream/` — Cloudflare Stream webhooks

## Conventions

### Video Playback
- Autoplay muted (browser policy compliance)
- Single active video at a time
- Use refs for logic state, useState only for UI rendering
- Destroy HLS instances when not visible
- Mobile Safari: call `play()` synchronously in tap handler, never await readyState

```tsx
// CRITICAL pattern for video state
const userPausedRef = useRef<boolean>(false);  // For logic decisions
const [isUserPaused, setIsUserPaused] = useState(false);  // For rendering only
```

### TypeScript
- Strict mode enabled—avoid `any`
- Path aliases: `@/*` → `src/*`, `@/components/*`, `@/lib/*`, etc.

### Performance Priorities
1. Time to First Frame—video must play instantly
2. Scroll Performance—60fps, no jank
3. Bundle Size—code-split aggressively

### UI/UX
- Mobile-first design
- Touch targets minimum 44px
- Cross-browser: Safari, Chrome, in-app browsers (Instagram, TikTok)
- Modals: always X button, spring animations, blur background

### Testing
- Tests in `src/__tests__/` using Jest + React Testing Library
- Coverage threshold: 70%
