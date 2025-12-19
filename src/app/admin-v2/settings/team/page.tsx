'use client';

/**
 * The Hub - Team & Role Management
 * RBAC administration for the team
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useHubUser } from '@/contexts/HubUserContext';

// =============================================================================
// TYPES
// =============================================================================

interface RoleDefinition {
  slug: string;
  name: string;
  description: string | null;
  default_modules: string[];
  is_system: boolean;
  color: string;
  icon: string | null;
}

interface TeamMember {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  roles: Array<{
    role_slug: string;
    assigned_at: string;
  }>;
  created_at: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function RoleBadge({ role, size = 'sm' }: { role: RoleDefinition; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses}`}
      style={{ backgroundColor: `${role.color}20`, color: role.color }}
    >
      <RoleIcon icon={role.icon} />
      {role.name}
    </span>
  );
}

function RoleIcon({ icon }: { icon: string | null }) {
  const iconMap: Record<string, JSX.Element> = {
    shield: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    megaphone: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
      </svg>
    ),
    pencil: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
      </svg>
    ),
    tag: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
    headset: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    code: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    truck: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    calculator: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
      </svg>
    ),
    users: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    chart: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    clipboard: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  };

  return iconMap[icon || ''] || null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// =============================================================================
// ROLE CARD
// =============================================================================

function RoleCard({ role }: { role: RoleDefinition }) {
  const modules = Array.isArray(role.default_modules)
    ? role.default_modules
    : (typeof role.default_modules === 'string'
        ? JSON.parse(role.default_modules)
        : []);

  return (
    <div className="hub-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${role.color}20` }}
          >
            <span style={{ color: role.color }}>
              <RoleIcon icon={role.icon} />
            </span>
          </div>
          <div>
            <h3 className="font-medium text-[var(--hub-text-primary)]">{role.name}</h3>
            <p className="text-xs text-[var(--hub-text-muted)]">{role.slug}</p>
          </div>
        </div>
        {role.is_system && (
          <span className="hub-badge hub-badge-default text-xs">System</span>
        )}
      </div>

      {role.description && (
        <p className="text-sm text-[var(--hub-text-secondary)] mt-3">{role.description}</p>
      )}

      <div className="mt-3">
        <p className="text-xs text-[var(--hub-text-muted)] mb-1.5">Modules</p>
        <div className="flex flex-wrap gap-1.5">
          {modules[0] === '*' ? (
            <span className="px-2 py-0.5 rounded bg-[var(--hub-bg-tertiary)] text-xs text-[var(--hub-text-secondary)]">
              All Modules
            </span>
          ) : (
            modules.map((mod: string) => (
              <span
                key={mod}
                className="px-2 py-0.5 rounded bg-[var(--hub-bg-tertiary)] text-xs text-[var(--hub-text-secondary)] capitalize"
              >
                {mod}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MEMBER CARD
// =============================================================================

function MemberCard({
  member,
  roles,
  onAssignRole,
  onRemoveRole,
}: {
  member: TeamMember;
  roles: RoleDefinition[];
  onAssignRole: (roleSlug: string) => void;
  onRemoveRole: (roleSlug: string) => void;
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const memberRoleSlugs = member.roles.map((r) => r.role_slug);
  const availableRoles = roles.filter((r) => !memberRoleSlugs.includes(r.slug));

  return (
    <div className="hub-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[var(--hub-accent)] flex items-center justify-center text-white font-medium">
            {(member.display_name || member.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-medium text-[var(--hub-text-primary)]">
              {member.display_name || member.email}
            </h3>
            <p className="text-xs text-[var(--hub-text-muted)]">{member.email}</p>
          </div>
        </div>

        {/* Add role button */}
        {availableRoles.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="hub-btn hub-btn-secondary text-xs py-1.5"
            >
              + Role
            </button>

            {showRoleMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowRoleMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-[var(--hub-border)] bg-[var(--hub-bg-secondary)] shadow-lg overflow-hidden">
                  {availableRoles.map((role) => (
                    <button
                      key={role.slug}
                      onClick={() => {
                        onAssignRole(role.slug);
                        setShowRoleMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-[var(--hub-text-primary)] hover:bg-[var(--hub-bg-tertiary)] flex items-center gap-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      {role.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Current roles */}
      <div className="mt-3">
        {member.is_admin && memberRoleSlugs.length === 0 && (
          <div className="flex items-center gap-2">
            <span className="hub-badge hub-badge-accent">Legacy Admin</span>
            <span className="text-xs text-[var(--hub-text-muted)]">Full access via is_admin flag</span>
          </div>
        )}

        {memberRoleSlugs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {member.roles.map((userRole) => {
              const roleDef = roles.find((r) => r.slug === userRole.role_slug);
              if (!roleDef) return null;
              return (
                <div key={userRole.role_slug} className="flex items-center gap-1">
                  <RoleBadge role={roleDef} />
                  <button
                    onClick={() => onRemoveRole(userRole.role_slug)}
                    className="p-0.5 text-[var(--hub-text-muted)] hover:text-[var(--hub-error)] transition-colors"
                    title="Remove role"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--hub-text-muted)] mt-2">
        Joined {formatDate(member.created_at)}
      </p>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TeamPage() {
  const { user, canAccess } = useHubUser();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'roles'>('members');

  const isAdmin = canAccess('system', 'admin');

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/v2/auth/roles', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.roles)) {
          setRoles(
            data.roles.map((r: any) => ({
              ...r,
              default_modules: typeof r.default_modules === 'string'
                ? JSON.parse(r.default_modules)
                : r.default_modules,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  }, []);

  // Fetch members (users with their roles)
  const fetchMembers = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          // Map users to team members
          const mapped: TeamMember[] = data.users.map((u: any) => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name || u.displayName,
            is_admin: Boolean(u.is_admin || u.isAdmin),
            roles: u.roles || [],
            created_at: u.created_at || u.createdAt,
          }));
          setMembers(mapped);
        }
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchRoles(), fetchMembers()]).finally(() => setIsLoading(false));
  }, [fetchRoles, fetchMembers]);

  // Assign role
  const assignRole = async (userId: string, roleSlug: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/v2/auth/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'assign', userId, roleSlug }),
      });

      if (res.ok) {
        fetchMembers(); // Refresh
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to assign role');
      }
    } catch (error) {
      console.error('Failed to assign role:', error);
    }
  };

  // Remove role
  const removeRole = async (userId: string, roleSlug: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/v2/auth/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'remove', userId, roleSlug }),
      });

      if (res.ok) {
        fetchMembers(); // Refresh
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove role');
      }
    } catch (error) {
      console.error('Failed to remove role:', error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--hub-error-bg)] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[var(--hub-error)]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-[var(--hub-text-primary)] mb-2">
          Access Denied
        </h2>
        <p className="text-[var(--hub-text-muted)] mb-6 max-w-md">
          You need administrator privileges to manage team roles.
        </p>
        <Link href="/admin-v2" className="hub-btn hub-btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--hub-text-muted)] mb-1">
            <Link href="/admin-v2" className="hover:text-[var(--hub-text-secondary)]">
              Dashboard
            </Link>
            <span>/</span>
            <span>Team</span>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--hub-text-primary)]">
            Team & Roles
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--hub-border)] -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'members'
              ? 'border-[var(--hub-accent)] text-[var(--hub-text-primary)]'
              : 'border-transparent text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)]'
          }`}
        >
          Team Members ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'roles'
              ? 'border-[var(--hub-accent)] text-[var(--hub-text-primary)]'
              : 'border-transparent text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)]'
          }`}
        >
          Roles ({roles.length})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="hub-card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--hub-bg-tertiary)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[var(--hub-bg-tertiary)] rounded w-1/2" />
                  <div className="h-3 bg-[var(--hub-bg-tertiary)] rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'members' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              roles={roles}
              onAssignRole={(roleSlug) => assignRole(member.id, roleSlug)}
              onRemoveRole={(roleSlug) => removeRole(member.id, roleSlug)}
            />
          ))}
          {members.length === 0 && (
            <div className="col-span-full hub-card p-8 text-center">
              <p className="text-[var(--hub-text-muted)]">No team members found</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <RoleCard key={role.slug} role={role} />
          ))}
          {roles.length === 0 && (
            <div className="col-span-full hub-card p-8 text-center">
              <p className="text-[var(--hub-text-muted)]">No roles defined</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
