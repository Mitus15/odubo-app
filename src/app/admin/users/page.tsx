"use client";
import { useEffect, useState, useCallback } from 'react';

interface UserRow {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_admin?: number | boolean;
  email_verified?: number | boolean;
  created_at?: string;
}

interface AdminRole {
  id: string;
  name: string;
  display_name: string;
  description: string;
  sections: string[];
  color: string;
  is_system: boolean;
}

interface UserRoleAssignment {
  role_id: string;
  name: string;
  display_name: string;
  color: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [userRolesMap, setUserRolesMap] = useState<Record<string, UserRoleAssignment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<string[]>([]);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Fetch all data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch users, roles, and user-role assignments in parallel
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/roles', { cache: 'no-store' }),
      ]);

      if (!usersRes.ok) throw new Error('Failed to fetch users');
      if (!rolesRes.ok) throw new Error('Failed to fetch roles');

      const usersData = await usersRes.json() as { users: UserRow[] };
      const rolesData = await rolesRes.json() as { roles: AdminRole[] };

      setUsers(usersData.users || []);
      setRoles(rolesData.roles || []);

      // Fetch roles for each user
      const rolePromises = (usersData.users || []).map(async (user: UserRow) => {
        try {
          const res = await fetch(`/api/admin/user-roles?user_id=${user.id}`);
          if (!res.ok) return { userId: user.id, roles: [] };
          const data = await res.json() as { roles: UserRoleAssignment[] };
          return { userId: user.id, roles: data.roles || [] };
        } catch {
          return { userId: user.id, roles: [] };
        }
      });

      const userRolesResults = await Promise.all(rolePromises);
      const rolesMap: Record<string, UserRoleAssignment[]> = {};
      userRolesResults.forEach(r => { rolesMap[r.userId] = r.roles; });
      setUserRolesMap(rolesMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Toggle role for a user
  const toggleRole = async (userId: string, roleId: string, hasRole: boolean) => {
    try {
      const method = hasRole ? 'DELETE' : 'POST';
      const res = await fetch('/api/admin/user-roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role_id: roleId }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to update role');
      }

      // Update local state
      setUserRolesMap(prev => {
        const current = prev[userId] || [];
        if (hasRole) {
          return { ...prev, [userId]: current.filter(r => r.role_id !== roleId) };
        } else {
          const role = roles.find(r => r.id === roleId);
          if (!role) return prev;
          return {
            ...prev,
            [userId]: [...current, {
              role_id: role.id,
              name: role.name,
              display_name: role.display_name,
              color: role.color,
            }],
          };
        }
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  // Send invite
  const sendInvite = async () => {
    setInviteResult(null);
    if (!inviteEmail) {
      setInviteResult('Please enter an email address');
      return;
    }
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, roles: inviteRoles }),
      });
      const data = await res.json() as { invite?: { token: string }; error?: string };
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      if (data.invite?.token) {
        setInviteResult(`Invite created! Token: ${data.invite.token}`);
        setInviteEmail('');
        setInviteRoles([]);
      } else {
        setInviteResult('Invite created');
      }
    } catch (e) {
      setInviteResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const getUserDisplayName = (user: UserRow) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return user.username || user.email.split('@')[0];
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#ede8df]">Team Members</h1>
          <p className="text-sm text-[#726d6c] mt-1">Manage user access and role assignments</p>
        </div>
      </div>

      {/* Invite Section */}
      <div className="bg-[#1a1816] rounded-xl border border-[#302927] p-5 mb-6">
        <h2 className="text-sm font-medium text-[#b2a491] mb-4">Invite Team Member</h2>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#0d0c0a] border border-[#302927] text-[#ede8df] placeholder:text-[#502d26] focus:border-[#843c2d] focus:outline-none"
            />
            <button
              onClick={sendInvite}
              className="px-6 py-2.5 rounded-lg bg-[#843c2d] hover:bg-[#6b3225] text-white font-medium transition-colors"
            >
              Send Invite
            </button>
          </div>

          {/* Role Selection for Invite */}
          <div>
            <label className="block text-xs text-[#726d6c] mb-2">Assign Roles</label>
            <div className="flex flex-wrap gap-2">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => {
                    setInviteRoles(prev =>
                      prev.includes(role.id)
                        ? prev.filter(r => r !== role.id)
                        : [...prev, role.id]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    inviteRoles.includes(role.id)
                      ? 'text-white'
                      : 'bg-[#302927] text-[#726d6c] hover:text-[#b2a491]'
                  }`}
                  style={inviteRoles.includes(role.id) ? { backgroundColor: role.color } : {}}
                >
                  {role.display_name}
                </button>
              ))}
            </div>
          </div>

          {inviteResult && (
            <div className={`text-sm p-3 rounded-lg ${
              inviteResult.startsWith('Error')
                ? 'bg-red-500/10 text-red-400'
                : 'bg-green-500/10 text-green-400'
            }`}>
              {inviteResult}
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center p-8 text-red-400">{error}</div>
      ) : (
        <div className="space-y-3">
          {users.map(user => {
            const userRoles = userRolesMap[user.id] || [];
            const isEditing = editingUserId === user.id;

            return (
              <div
                key={user.id}
                className="bg-[#1a1816] rounded-xl border border-[#302927] p-4 hover:border-[#502d26]/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-[#302927] flex items-center justify-center text-[#b2a491] text-lg font-medium flex-shrink-0">
                    {getUserDisplayName(user).charAt(0).toUpperCase()}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[#ede8df]">{getUserDisplayName(user)}</span>
                      {user.email_verified && (
                        <span className="text-green-500 text-xs">Verified</span>
                      )}
                    </div>
                    <div className="text-sm text-[#726d6c]">{user.email}</div>

                    {/* Role Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {userRoles.length > 0 ? (
                        userRoles.map(role => (
                          <span
                            key={role.role_id}
                            className="px-2 py-0.5 rounded text-xs font-medium text-white"
                            style={{ backgroundColor: role.color }}
                          >
                            {role.display_name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#502d26]">No roles assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Edit Button */}
                  <button
                    onClick={() => setEditingUserId(isEditing ? null : user.id)}
                    className="px-3 py-1.5 rounded-lg text-sm text-[#726d6c] hover:text-[#b2a491] hover:bg-[#302927] transition-colors"
                  >
                    {isEditing ? 'Done' : 'Edit Roles'}
                  </button>
                </div>

                {/* Role Editor */}
                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-[#302927]">
                    <label className="block text-xs text-[#726d6c] mb-3">Assign Roles</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {roles.map(role => {
                        const hasRole = userRoles.some(r => r.role_id === role.id);
                        return (
                          <label
                            key={role.id}
                            className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                              hasRole
                                ? 'bg-[#302927] border-2'
                                : 'bg-[#0d0c0a] border border-[#302927] hover:border-[#502d26]'
                            }`}
                            style={hasRole ? { borderColor: role.color } : {}}
                          >
                            <input
                              type="checkbox"
                              checked={hasRole}
                              onChange={() => toggleRole(user.id, role.id, hasRole)}
                              className="sr-only"
                            />
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                hasRole ? 'text-white' : 'bg-[#302927]'
                              }`}
                              style={hasRole ? { backgroundColor: role.color } : {}}
                            >
                              {hasRole && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-[#ede8df] truncate">{role.display_name}</div>
                              <div className="text-xs text-[#726d6c] truncate">{role.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Role Legend */}
      <div className="mt-8 p-4 bg-[#302927]/30 rounded-xl border border-[#502d26]/20">
        <h4 className="text-sm font-medium text-[#b2a491] mb-3">Role Permissions</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {roles.map(role => (
            <div key={role.id} className="flex items-start gap-2">
              <div
                className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                style={{ backgroundColor: role.color }}
              />
              <div>
                <div className="text-sm font-medium text-[#ede8df]">{role.display_name}</div>
                <div className="text-xs text-[#726d6c]">
                  {role.sections.includes('*')
                    ? 'Full access to all sections'
                    : `Access: ${role.sections.join(', ')}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
