import { z } from 'zod';

export const GalleryCreateSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().nullable(),
  code: z.string().regex(/^[A-Z0-9]{4,12}$/).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  config: z
    .object({
      featured: z.boolean().optional(),
      persistent: z.boolean().optional(),
      visibility: z.enum(['private', 'link']).optional(),
    })
    .optional()
    .nullable(),
});

export const GalleryUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(1000).optional().nullable(),
  code: z.string().regex(/^[A-Z0-9]{4,12}$/).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  config: z
    .object({
      featured: z.boolean().optional(),
      persistent: z.boolean().optional(),
      visibility: z.enum(['private', 'link']).optional(),
    })
    .optional()
    .nullable(),
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
