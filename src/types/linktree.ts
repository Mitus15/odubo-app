/**
 * LinkTree / Connectivity Hub Types
 * Branded link aggregator for digital presence management
 */

export type LinkCategory = 
  | 'streaming'      // Spotify, Apple Music, YouTube Music, Tidal, etc.
  | 'social'         // Instagram, TikTok, Twitter/X, Facebook
  | 'video'          // YouTube, Vimeo
  | 'fashion'        // Fashion-specific Instagram, Pinterest
  | 'admin'          // Personal/admin-only links
  | 'store'          // Shopify, merch stores
  | 'other';         // Misc links

export interface LinkTreeItem {
  id: number;
  title: string;
  url: string;
  category: LinkCategory;
  platform?: string;        // e.g., 'spotify', 'instagram', 'tiktok'
  icon_url?: string;        // Optional custom icon
  description?: string;     // Optional description
  display_order: number;    // Sort order within category
  is_active: boolean;       // Show/hide
  is_featured: boolean;     // Featured links (show at top)
  
  // Analytics & Management
  click_count: number;
  last_clicked_at?: string;
  last_updated_at: string;
  last_posted_at?: string;  // When content was last posted to this platform
  managed_by?: string;      // Admin user managing this link
  notes?: string;           // Internal notes for admin
  
  created_at: string;
  updated_at: string;
}

export interface LinkTreeCategory {
  category: LinkCategory;
  label: string;
  icon: string;
  links: LinkTreeItem[];
}

export interface LinkTreeAnalytics {
  linkId: number;
  clicks: number;
  lastClicked?: string;
  lastUpdated: string;
  managedBy?: string;
}
