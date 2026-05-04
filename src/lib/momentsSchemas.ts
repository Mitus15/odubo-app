import { z } from 'zod';

// =============================================================================
// Gallery Types & Enums
// =============================================================================

/**
 * Gallery types for different purposes:
 * - event: Time-bounded events with public uploads (concerts, meetups)
 * - collection: Admin-curated photo collections
 * - lookbook: Product/fashion showcase galleries
 * - showcase: Best-of compilations, highlights
 * - bts: Behind-the-scenes content
 * - campaign: Marketing campaigns (album launches, product drops)
 * - archive: Historical photo archives
 */
export const GalleryTypeEnum = z.enum([
  'event',
  'collection',
  'lookbook',
  'showcase',
  'bts',
  'campaign',
  'archive',
]);
export type GalleryType = z.infer<typeof GalleryTypeEnum>;

/**
 * Upload mode controls who can add photos:
 * - public: Anyone can upload (event galleries)
 * - admin: Only admin can upload (curated galleries)
 */
export const UploadModeEnum = z.enum(['public', 'admin']);
export type UploadMode = z.infer<typeof UploadModeEnum>;

/**
 * Link types for gallery content associations
 */
export const GalleryLinkTypeEnum = z.enum([
  'product',  // Shopify product
  'video',    // Videos from videos table
  'clip',     // Clips (short-form videos)
  'track',    // Music tracks
  'album',    // Music albums
  'event',    // Events
  'gallery',  // Other galleries
]);
export type GalleryLinkType = z.infer<typeof GalleryLinkTypeEnum>;

/**
 * Schema for gallery content links
 */
export const GalleryLinkSchema = z.object({
  link_type: GalleryLinkTypeEnum,
  link_id: z.string(),
  link_handle: z.string().optional(),
  is_primary: z.boolean().default(false),
  display_label: z.string().max(100).optional(),
  sort_order: z.number().int().default(0),
});
export type GalleryLinkInput = z.infer<typeof GalleryLinkSchema>;

// =============================================================================
// Gallery CRUD Schemas
// =============================================================================

export const GalleryCreateSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  code: z.string().regex(/^[A-Z0-9]{4,12}$/).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  // New fields for custom galleries
  gallery_type: GalleryTypeEnum.default('event'),
  upload_mode: UploadModeEnum.default('public'),
  cover_photo_key: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
  // Content links (optional at creation)
  links: z.array(GalleryLinkSchema).optional(),
  config: z
    .object({
      featured: z.boolean().optional(),
      persistent: z.boolean().optional(),
      visibility: z.enum(['private', 'link', 'public']).optional(),
    })
    .optional()
    .nullable(),
  // Retention settings (default: 1 year, host can extend)
  expires_at: z.string().datetime().optional().nullable(),
  is_permanent: z.boolean().optional().default(false),
  content_rights: z.enum(['non-exclusive', 'exclusive', 'all-rights']).optional().default('non-exclusive'),
});

export const GalleryUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(1000).optional().nullable(),
  code: z.string().regex(/^[A-Z0-9]{4,12}$/).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  // New fields for custom galleries
  gallery_type: GalleryTypeEnum.optional(),
  upload_mode: UploadModeEnum.optional(),
  cover_photo_key: z.string().optional().nullable(),
  sort_order: z.number().int().optional(),
  // Content links (replaces all existing links when provided)
  links: z.array(GalleryLinkSchema).optional(),
  config: z
    .object({
      featured: z.boolean().optional(),
      persistent: z.boolean().optional(),
      visibility: z.enum(['private', 'link', 'public']).optional(),
    })
    .optional(),
  // Retention settings (hosts can extend)
  expires_at: z.string().datetime().optional().nullable(),
  is_permanent: z.boolean().optional(),
  content_rights: z.enum(['non-exclusive', 'exclusive', 'all-rights']).optional(),
});

// RSVP creation schema: user provides email, optional name, and selected reminder offsets (minutes before start)
export const RsvpCreateSchema = z.object({
  galleryId: z.number().int().positive(),
  email: z.string().email().optional(),
  name: z.string().max(160).optional().nullable(),
  instagram_handle: z.string().regex(/^@?[A-Za-z0-9._]{1,30}$/).optional().nullable(),
  instagram_opt_in: z.boolean().optional().default(false),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Use E.164 format, e.g., +15551234567').optional(),
  sms_opt_in: z.boolean().optional().default(false),
  reminder_offsets: z.array(z.number().int().positive()).max(6).default([]),
}).refine(d => d.email || d.instagram_handle || d.phone, { message: 'Provide email, Instagram, or phone' });

export const RsvpStatusQuerySchema = z.object({
  galleryId: z.number().int().positive(),
  email: z.string().email().optional(),
  instagram_handle: z.string().regex(/^@?[A-Za-z0-9._]{1,30}$/).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
});

export const EventCreateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  ticket_price: z.number().min(0).optional().default(0),
  is_public: z.boolean().optional().default(true),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional().default('draft'),
});

export const EventUpdateSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  ticket_price: z.number().min(0).optional(),
  is_public: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
});

export type GalleryCreateInput = z.infer<typeof GalleryCreateSchema>;
export type GalleryUpdateInput = z.infer<typeof GalleryUpdateSchema>;
export type EventCreateInput = z.infer<typeof EventCreateSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateSchema>;
export type RsvpCreateInput = z.infer<typeof RsvpCreateSchema>;
export type RsvpStatusQueryInput = z.infer<typeof RsvpStatusQuerySchema>;

// =============================================================================
// Gallery Link Management Schemas
// =============================================================================

/**
 * Schema for adding a single link to a gallery
 */
export const GalleryLinkAddSchema = z.object({
  link_type: GalleryLinkTypeEnum,
  link_id: z.string(),
  link_handle: z.string().optional(),
  is_primary: z.boolean().default(false),
  display_label: z.string().max(100).optional(),
  sort_order: z.number().int().optional(),
});
export type GalleryLinkAddInput = z.infer<typeof GalleryLinkAddSchema>;

/**
 * Schema for updating a link
 */
export const GalleryLinkUpdateSchema = z.object({
  is_primary: z.boolean().optional(),
  display_label: z.string().max(100).optional().nullable(),
  sort_order: z.number().int().optional(),
});
export type GalleryLinkUpdateInput = z.infer<typeof GalleryLinkUpdateSchema>;

/**
 * Schema for reordering links
 */
export const GalleryLinksReorderSchema = z.object({
  link_ids: z.array(z.number().int().positive()),
});
export type GalleryLinksReorderInput = z.infer<typeof GalleryLinksReorderSchema>;

// =============================================================================
// Photo Enhancement Schemas
// =============================================================================

/**
 * Schema for recording a photo with enhanced fields
 */
export const PhotoRecordSchema = z.object({
  galleryId: z.number().int().positive().optional(),
  code: z.string().regex(/^[A-Z0-9]{4,12}$/).optional(),
  r2Key: z.string(),
  thumbnailKey: z.string().optional(),
  originalFilename: z.string().optional(),
  userName: z.string().max(160).optional(),
  mediaType: z.enum(['photo', 'video']).default('photo'),
  // New fields
  source: z.enum(['public', 'admin', 'import']).default('public'),
  caption: z.string().max(500).optional(),
  sort_order: z.number().int().optional(),
}).refine(d => d.galleryId || d.code, { message: 'Provide galleryId or code' });
export type PhotoRecordInput = z.infer<typeof PhotoRecordSchema>;
