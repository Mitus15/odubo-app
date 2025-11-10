import { z } from 'zod';

// User schema with reasonable password policy for streaming platform
export const userSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .max(128, "Password is too long"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  is_admin: z.boolean().optional().default(false),
});

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain at least one letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .max(128, "Password is too long"),
  confirmNewPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

// Film schema
export const filmSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.number().positive(),
  release_date: z.string().optional(),
  genre: z.string().optional(),
  director: z.string().optional(),
  cast: z.array(z.string()).optional(),
  rating: z.number().min(0).max(10).optional(),
  poster_url: z.string().url().optional(),
  trailer_url: z.string().url().optional(),
  streaming_url: z.string().url().optional(),
  is_featured: z.boolean().default(false),
  is_premium: z.boolean().default(false),
  price: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  language: z.string().default('English'),
  subtitles: z.array(z.string()).default([]),
  audio_tracks: z.array(z.string()).default([]),
  quality_options: z.array(z.string()).default([]),
  age_rating: z.string().optional(),
  content_warnings: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Album schema
export const albumSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  description: z.string().optional(),
  release_date: z.string().optional(),
  genre: z.string().optional(),
  album_art_url: z.string().url().optional(),
  tracks: z.array(z.object({
    title: z.string().min(1),
    duration: z.number().positive(),
    track_number: z.number().positive(),
    audio_url: z.string().url().optional(),
    lyrics: z.string().optional(),
    is_explicit: z.boolean().default(false),
  })),
  is_featured: z.boolean().default(false),
  is_premium: z.boolean().default(false),
  price: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Track schema
export const trackSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().optional(),
  duration: z.number().positive(),
  track_number: z.number().positive().optional(),
  audio_url: z.string().url().optional(),
  lyrics: z.string().optional(),
  is_explicit: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  is_premium: z.boolean().default(false),
  price: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  genre: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Product schema for e-commerce
export const productSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().default('USD'),
  compare_at_price: z.number().positive().optional(),
  cost_per_item: z.number().positive().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  weight: z.number().positive().optional(),
  weight_unit: z.string().default('kg'),
  inventory_quantity: z.number().int().min(0),
  inventory_policy: z.enum(['deny', 'continue']).default('deny'),
  inventory_tracking: z.enum(['shopify', 'not_tracked']).default('shopify'),
  requires_shipping: z.boolean().default(true),
  taxable: z.boolean().default(true),
  gift_card: z.boolean().default(false),
  status: z.enum(['active', 'archived', 'draft']).default('active'),
  vendor: z.string().optional(),
  product_type: z.string().optional(),
  tags: z.array(z.string()).default([]),
  collections: z.array(z.string()).default([]),
  variants: z.array(z.object({
    title: z.string().min(1),
    price: z.number().positive(),
    compare_at_price: z.number().positive().optional(),
    cost_per_item: z.number().positive().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    weight: z.number().positive().optional(),
    weight_unit: z.string().default('kg'),
    inventory_quantity: z.number().int().min(0),
    inventory_policy: z.enum(['deny', 'continue']).default('deny'),
    inventory_tracking: z.enum(['shopify', 'not_tracked']).default('shopify'),
    requires_shipping: z.boolean().default(true),
    taxable: z.boolean().default(true),
    gift_card: z.boolean().default(false),
    status: z.enum(['active', 'archived', 'draft']).default('active'),
    option1: z.string().optional(),
    option2: z.string().optional(),
    option3: z.string().optional(),
  })),
  images: z.array(z.object({
    src: z.string().url(),
    alt: z.string().optional(),
    position: z.number().int().min(1),
  })),
  options: z.array(z.object({
    name: z.string().min(1),
    values: z.array(z.string()),
    position: z.number().int().min(1),
  })),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Collection schema
export const collectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  handle: z.string().min(1),
  published_at: z.string().optional(),
  sort_order: z.enum(['manual', 'best-selling', 'title-asc', 'title-desc', 'price-asc', 'price-desc', 'created-asc', 'created-desc']).default('manual'),
  template_suffix: z.string().optional(),
  products_count: z.number().int().min(0).default(0),
  image: z.object({
    src: z.string().url(),
    alt: z.string().optional(),
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// User preferences schema
export const userPreferencesSchema = z.object({
  preferences: z.object({
    marketing: z.boolean().default(false),
    order_updates: z.boolean().default(true),
    new_releases: z.boolean().default(true),
    recommendations: z.boolean().default(true),
  }).default({
    marketing: false,
    order_updates: true,
    new_releases: true,
    recommendations: true,
  }),

  privacy: z.object({
    profile_visible: z.boolean().default(true),
    activity_visible: z.boolean().default(true),
    allow_tracking: z.boolean().default(false),
  }).default({
    profile_visible: true,
    activity_visible: true,
    allow_tracking: false,
  }),

  streaming: z.object({
    autoplay: z.boolean().default(true),
    quality: z.enum(['auto', 'low', 'medium', 'high']).default('auto'),
    subtitles: z.boolean().default(false),
    language: z.string().default('en'),
  }).default({
    autoplay: true,
    quality: 'auto',
    subtitles: false,
    language: 'en',
  }),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  timezone: z.string().optional(),
  locale: z.string().default('en-US'),
});

// Export all schemas
export type User = z.infer<typeof userSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type Film = z.infer<typeof filmSchema>;
export type Album = z.infer<typeof albumSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Product = z.infer<typeof productSchema>;
export type Collection = z.infer<typeof collectionSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

// Lightweight helpers for common input validation/sanitization
export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
