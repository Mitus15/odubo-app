/**
 * The Hub - Type Definitions
 * Enterprise Business Operating System for Odubo
 */

// =============================================================================
// PERMISSION TYPES
// =============================================================================

export type Permission =
  | 'read'     // View data
  | 'write'    // Create and update
  | 'delete'   // Remove data
  | 'admin'    // Full access including settings
  | 'approve'  // Approve workflows (social posts, etc.)
  | 'export';  // Export data (reports, CSV, etc.)

export type Module =
  | 'content'        // Videos, clips, music, moments
  | 'social'         // Social media distribution
  | 'commerce'       // Products, orders, customers
  | 'analytics'      // Metrics and dashboards
  | 'communications' // Tickets, messages, campaigns
  | 'projects'       // Project management
  | 'events'         // Event operations
  | 'system'         // System health, audit, team
  | 'reports'        // Report generation
  | 'marketing';     // Campaigns (can be merged with social)

export type ModulePermissions = {
  [K in Module]?: Permission[];
};

// =============================================================================
// ROLE TYPES
// =============================================================================

export type RoleSlug =
  | 'admin'
  | 'social_manager'
  | 'content_editor'
  | 'merchandiser'
  | 'customer_service'
  | 'developer'
  | 'scm_manager'
  | 'accountant'
  | 'hr_manager'
  | 'marketing_manager'
  | 'project_manager';

export interface RoleDefinition {
  slug: RoleSlug;
  name: string;
  description: string;
  defaultModules: Module[] | ['*'];
  defaultPermissions: ModulePermissions | { '*': Permission[] };
  isSystem: boolean;
  color: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: number;
  userId: string;
  roleSlug: RoleSlug;
  moduleOverrides?: ModulePermissions;
  permissionOverrides?: ModulePermissions;
  assignedBy: string | null;
  assignedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  notes: string | null;
}

// =============================================================================
// USER TYPES
// =============================================================================

export interface HubUser {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  roles: UserRole[];
  permissions: ResolvedPermissions;
  accessibleModules: Module[];
  createdAt: string;
}

export interface ResolvedPermissions {
  isFullAdmin: boolean;
  modules: {
    [K in Module]?: {
      canRead: boolean;
      canWrite: boolean;
      canDelete: boolean;
      canAdmin: boolean;
      canApprove: boolean;
      canExport: boolean;
    };
  };
}

// =============================================================================
// NAVIGATION TYPES
// =============================================================================

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  module: Module;
  badge?: number | string;
  children?: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// =============================================================================
// DATA TABLE TYPES
// =============================================================================

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => React.ReactNode;
  mobileHidden?: boolean; // Hide on mobile card view
  mobilePrimary?: boolean; // Show as primary field on mobile
}

export interface TableFilter {
  key: string;
  label: string;
  type: 'select' | 'search' | 'date' | 'dateRange' | 'multiSelect';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface TableAction<T> {
  id: string;
  label: string;
  icon?: string;
  onClick: (row: T) => void;
  variant?: 'default' | 'destructive' | 'success';
  requiresConfirm?: boolean;
  confirmMessage?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

// =============================================================================
// CONTENT TYPES
// =============================================================================

export interface Video {
  id: number;
  uid: string;
  title: string;
  description: string | null;
  url: string;
  posterUrl: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  category: string | null;
  type: 'music-video' | 'film' | 'clip' | 'behind-the-scenes' | 'live';
  artistName: string | null;
  mood: string | null;
  aiDescription: string | null;
  tags: string[] | null;
  isPublic: boolean;
  status: 'draft' | 'processing' | 'ready' | 'published' | 'archived';
  shopifyProductId: string | null;
  shopifyProductHandle: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Clip {
  id: number;
  videoId: number;
  title: string;
  description: string | null;
  startTime: number;
  endTime: number;
  thumbnailUrl: string | null;
  status: 'pending' | 'processing' | 'ready' | 'published';
  platforms: string[]; // TikTok, Instagram, YouTube, Twitter
  publishedAt: string | null;
  createdAt: string;
}

export interface Album {
  id: number;
  title: string;
  artistName: string;
  coverUrl: string | null;
  releaseDate: string | null;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  trackCount: number;
  totalDuration: number;
  createdAt: string;
}

export interface Track {
  id: number;
  albumId: number;
  title: string;
  artistName: string;
  duration: number;
  trackNumber: number;
  audioUrl: string | null;
  status: 'draft' | 'published';
  createdAt: string;
}

export interface Gallery {
  id: number;
  code: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  photoCount: number;
  isFeatured: boolean;
  isPublic: boolean;
  isPersistent: boolean;
  startDatetime: string | null;
  endDatetime: string | null;
  capacity: number | null;
  ticketPrice: number | null;
  status: 'draft' | 'active' | 'closed' | 'archived';
  createdAt: string;
}

export interface GalleryPhoto {
  id: number;
  galleryId: number;
  mediaType: 'photo' | 'video';
  url: string;
  thumbnailUrl: string | null;
  caption: string | null;
  submittedBy: string | null;
  instagramHandle: string | null;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
}

// =============================================================================
// STAT CARD TYPES
// =============================================================================

export interface StatCardData {
  label: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    period: string;
  };
  icon?: string;
  color?: string;
  href?: string;
  sparkline?: number[];
}

// =============================================================================
// TOAST / FEEDBACK TYPES
// =============================================================================

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// FORM TYPES
// =============================================================================

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date' | 'datetime-local';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  options?: { value: string; label: string }[];
}

// =============================================================================
// MOBILE DRAWER TYPES
// =============================================================================

export interface DrawerAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface DrawerSection {
  id: string;
  title?: string;
  actions: DrawerAction[];
}
