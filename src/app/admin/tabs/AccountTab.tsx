'use client';

import { useState, useEffect } from 'react';

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_admin?: number | boolean;
  created_at?: string;
}

export default function AccountTab() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json() as { user?: UserProfile };
        if (data.user) {
          setProfile(data.user);
          setFirstName(data.user.first_name || '');
          setLastName(data.user.last_name || '');
          setUsername(data.user.username || '');
        }
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          username: username,
        }),
      });

      if (res.ok) {
        setSaved(true);
        // Clear sessionStorage cache to refresh user data
        sessionStorage.removeItem('me.cache');
        sessionStorage.removeItem('me.cache.ts');
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error || 'Failed to save profile');
      }
    } catch (e) {
      console.error('Failed to save profile', e);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!profile) return;

    // Validation
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-password',
          userId: profile.id,
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        const data = await res.json() as { error?: string };
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (e) {
      console.error('Failed to change password', e);
      setPasswordError('Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('me.cache');
    sessionStorage.removeItem('me.cache.ts');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#ede8df]">Account Settings</h2>
        <p className="text-[#b2a491] text-sm mt-1">Manage your profile and security settings</p>
      </div>

      {/* Profile Section */}
      <div className="bg-[#302927] rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-[#ede8df]">Profile</h3>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-[#843c2d] text-[#ede8df] rounded-lg hover:bg-[#6d3224] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
              placeholder="Your first name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
              placeholder="Your last name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
            placeholder="Your username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Email</label>
          <input
            type="email"
            value={profile?.email || ''}
            disabled
            className="w-full px-3 py-2 bg-[#302927] text-[#726d6c] rounded-lg border border-[#502d26] cursor-not-allowed"
          />
          <p className="text-xs text-[#726d6c] mt-1">Email cannot be changed</p>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-[#302927] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#ede8df]">Change Password</h3>

        {passwordError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{passwordError}</p>
          </div>
        )}

        {passwordSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <p className="text-sm text-emerald-400">Password updated successfully</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
            placeholder="Enter current password"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#ede8df] mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#403633] text-[#ede8df] rounded-lg border border-[#502d26] focus:border-[#843c2d] focus:outline-none"
              placeholder="Confirm new password"
            />
          </div>
        </div>

        <button
          onClick={handleChangePassword}
          disabled={passwordSaving}
          className="px-4 py-2 text-sm font-medium bg-[#403633] text-[#ede8df] rounded-lg hover:bg-[#4a3e3a] disabled:opacity-50 transition-colors border border-[#502d26]"
        >
          {passwordSaving ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      {/* Session Info */}
      <div className="bg-[#302927] rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#ede8df]">Session Information</h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[#b2a491]">Role</span>
            <span className="text-[#ede8df] font-medium">
              {profile?.is_admin ? 'Administrator' : profile?.role || 'User'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#b2a491]">Member Since</span>
            <span className="text-[#ede8df]">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Logout Section */}
      <div className="bg-[#302927] rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#ede8df] mb-1">Sign Out</h3>
            <p className="text-sm text-[#b2a491]">Sign out of your admin account</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors border border-red-500/30"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
