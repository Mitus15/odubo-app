"use client";
import { useEffect, useState } from 'react';
import ScreenLayout from '@/components/ui/ScreenLayout';
import ScrollContainer from '@/components/ui/ScrollContainer';

type UserRow = { id: string; email: string; username: string; role?: string; is_admin?: number | boolean; email_verified?: number | boolean; created_at?: string };

// API response types
type UsersResponse = { users: UserRow[] };
type ErrorResponse = { error: string };
type InviteResponse = { invite: { token: string } } | ErrorResponse;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = (await res.json()) as UsersResponse | ErrorResponse;
      if (!res.ok) {
        const msg = (data as ErrorResponse).error || 'Failed';
        throw new Error(msg);
      }
      setUsers((data as UsersResponse).users || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, role: 'admin'|'viewer') => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, role }) });
      const data = (await res.json()) as UsersResponse | ErrorResponse;
      if (!res.ok) {
        const msg = (data as ErrorResponse).error || 'Role update failed';
        throw new Error(msg);
      }
      await load();
    } catch (e) { alert((e as any).message || 'Failed'); } finally { setLoading(false); }
  };

  const sendInvite = async () => {
    setInviteResult(null);
    try {
      const res = await fetch('/api/admin/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: inviteEmail }) });
      const data = (await res.json()) as InviteResponse;
      if (!res.ok) {
        const msg = (data as ErrorResponse).error || 'Invite failed';
        throw new Error(msg);
      }
      if ('invite' in data && data.invite?.token) {
        setInviteResult(`Invite created. Token: ${data.invite.token}`);
      } else {
        setInviteResult('Invite created');
      }
    } catch (e: any) {
      setInviteResult(`Error: ${e.message}`);
    }
  };

  return (
    <ScreenLayout>
      <ScrollContainer>
        <div className="max-w-5xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-[#ede8df] mb-4">Users & Roles</h1>
          <div className="glass-surface rounded-2xl border border-[#502d26]/30 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm text-[#b2a491] mb-1">Invite Admin by Email</label>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="admin@domain.com" className="w-full px-3 py-2 rounded-md bg-[#171616] border border-[#b2a491]/20 text-[#ede8df]" />
              </div>
              <button onClick={sendInvite} className="px-4 py-2 rounded-md bg-[#ede8df] text-[#171616] hover:bg-[#d9d3c9]">Send Invite</button>
            </div>
            {inviteResult && <div className="mt-2 text-sm text-[#b2a491] break-all">{inviteResult}</div>}
          </div>

          <div className="glass-surface rounded-2xl border border-[#502d26]/30 p-0 overflow-hidden">
            <table className="w-full text-left text-[#ede8df]">
              <thead className="bg-[#302927]">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Username</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Verified</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-t border-[#502d26]/30">
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.username}</td>
                    <td className="p-3">{(u.role as any) || (u.is_admin ? 'admin' : 'viewer')}</td>
                    <td className="p-3">{u.email_verified ? 'Yes' : 'No'}</td>
                    <td className="p-3 flex gap-2">
                      <button className="px-3 py-1 rounded bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60" onClick={() => setRole(u.id, 'admin')}>Make Admin</button>
                      <button className="px-3 py-1 rounded bg-[#302927] text-[#b2a491] hover:bg-[#502d26]/60" onClick={() => setRole(u.id, 'viewer')}>Make Viewer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="p-3 text-[#b2a491]">Loading…</div>}
            {error && <div className="p-3 text-red-400">{error}</div>}
          </div>
        </div>
      </ScrollContainer>
    </ScreenLayout>
  );
}


