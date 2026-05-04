"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Gallery {
  id: number;
  title: string;
  created_at: string;
  photo_count: number;
}

export default function MomentsProfilePage() {
  const [ig, setIg] = useState('');
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load Instagram handle from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('instagramHandle');
      if (stored) {
        const formatted = stored.startsWith('@') ? stored : `@${stored}`;
        setIg(formatted);
        fetchUserData(formatted);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  const fetchUserData = useCallback(async (handle: string) => {
    setLoading(true);
    try {
      const username = handle.replace('@', '');
      
      // Fetch galleries user has contributed to
      const galleriesRes = await fetch(`/api/moments/galleries/public?user=${encodeURIComponent(username)}&preview=false`);
      const galleriesData = await galleriesRes.json();
      if (galleriesRes.ok && Array.isArray(galleriesData.galleries)) {
        setGalleries(galleriesData.galleries);
      }
    } catch (e) {
      console.error('Failed to fetch user data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const formatted = ig.startsWith('@') ? ig : `@${ig}`;
      setIg(formatted);
      localStorage.setItem('instagramHandle', formatted.replace('@', ''));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchUserData(formatted);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('instagramHandle');
    setIg('');
    setGalleries([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171616] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#502d26]/40 border-t-[#843c2d] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#171616]">
      {/* Header */}
      <header className="bg-[#171616] border-b border-[#502d26]/20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/moments"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1a1918] hover:bg-[#252221] transition-colors"
            >
              <svg className="w-5 h-5 text-[#ede8df]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-[#ede8df]">Profile</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {/* Profile Section */}
        <section className="mb-8">
          <div className="rounded-2xl border border-[#502d26]/30 bg-[#1a1918] p-6">
            <h2 className="text-base font-semibold text-[#ede8df] mb-4">Your Profile</h2>
            
            <div className="space-y-4">
              {/* Instagram Handle */}
              <div>
                <label className="block text-xs text-[#726d6c] mb-1.5">Instagram Handle</label>
                <div className="flex gap-2">
                  <input
                    value={ig}
                    onChange={e => {
                      const v = e.target.value.trim();
                      setIg(v.startsWith('@') ? v : (v ? `@${v}` : ''));
                    }}
                    placeholder="@yourhandle"
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#302927] border border-[#502d26]/30 text-[#ede8df] placeholder-[#726d6c] text-sm focus:outline-none focus:border-[#843c2d]/50"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !ig}
                    className="px-4 py-2.5 rounded-lg bg-[#ede8df] text-[#171616] font-semibold text-sm disabled:opacity-50 hover:bg-[#f0e4d8] transition-colors"
                  >
                    {saving ? '...' : saved ? 'Saved!' : 'Save'}
                  </button>
                </div>
                <p className="text-xs text-[#726d6c] mt-1.5">
                  This is how others will see you in galleries
                </p>
              </div>

              {/* Clear Profile */}
              {ig && (
                <button
                  onClick={handleClear}
                  className="text-xs text-[#843c2d] hover:text-[#b2a491] transition-colors"
                >
                  Clear profile
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Galleries Section */}
        <section className="mb-8">
          <div className="rounded-2xl border border-[#502d26]/30 bg-[#1a1918] p-6">
            <h2 className="text-base font-semibold text-[#ede8df] mb-4">Your Galleries</h2>
            
            {!ig ? (
              <p className="text-sm text-[#726d6c]">
                Enter your Instagram handle above to see galleries you've attended
              </p>
            ) : galleries.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#252221] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#502d26]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                  </svg>
                </div>
                <p className="text-sm text-[#726d6c]">No galleries yet</p>
                <p className="text-xs text-[#726d6c] mt-1">Capture photos at events to see them here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {galleries.map(gallery => (
                  <Link
                    key={gallery.id}
                    href={`/moments/gallery/${gallery.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#302927] hover:bg-[#3a332f] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#ede8df]">{gallery.title}</p>
                      <p className="text-xs text-[#726d6c]">
                        {new Date(gallery.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#726d6c]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909" />
                      </svg>
                      {gallery.photo_count}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <div className="rounded-2xl border border-[#502d26]/30 bg-[#1a1918] p-6">
            <h2 className="text-base font-semibold text-[#ede8df] mb-4">Quick Actions</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/moments?tab=capture"
                className="flex items-center gap-3 p-3 rounded-lg bg-[#302927] hover:bg-[#3a332f] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#843c2d]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#ede8df]">Capture</p>
                  <p className="text-xs text-[#726d6c]">Join an event</p>
                </div>
              </Link>

              <Link
                href="/moments"
                className="flex items-center gap-3 p-3 rounded-lg bg-[#302927] hover:bg-[#3a332f] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#843c2d]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#843c2d]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[#ede8df]">Galleries</p>
                  <p className="text-xs text-[#726d6c]">Browse events</p>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
