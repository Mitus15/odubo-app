'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Moment = {
  id: number;
  title: string;
  description?: string;
  image_url?: string;
  video_url?: string;
  type: 'image' | 'video';
  created_at: string;
  is_featured?: boolean;
};

export default function AdminMomentsPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMoments();
  }, []);

  const fetchMoments = async () => {
    try {
      const res = await fetch('/api/moments');
      if (res.ok) {
        const data = await res.json() as { moments?: Moment[] };
        setMoments(data.moments || []);
      }
    } catch (error) {
      console.error('Failed to fetch moments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#ede8df]">Moments</h1>
            <p className="text-[#726d6c] mt-1">Manage photos and short clips</p>
          </div>
          <button className="px-4 py-2.5 bg-[#843c2d] hover:bg-[#9a4535] text-white rounded-lg font-medium transition-colors">
            + Add Moment
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
          </div>
        ) : moments.length === 0 ? (
          <div className="bg-[#1a1918]/60 border border-[#502d26]/20 rounded-xl p-8 sm:p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#302927]/50 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[#ede8df] mb-2">No moments yet</h2>
            <p className="text-[#726d6c] mb-6">Start capturing and sharing your moments</p>
            <button className="px-6 py-2.5 bg-[#843c2d] hover:bg-[#9a4535] text-white rounded-lg font-medium transition-colors">
              Add Your First Moment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {moments.map((moment) => (
              <div key={moment.id} className="bg-[#1a1918]/60 border border-[#502d26]/20 rounded-xl overflow-hidden group">
                <div className="aspect-square bg-[#302927]/50 relative">
                  {moment.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={moment.image_url} alt={moment.title} className="w-full h-full object-cover" />
                  )}
                  {moment.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button className="px-3 py-1.5 bg-white/20 rounded-lg text-white text-sm">Edit</button>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-medium text-[#ede8df] truncate">{moment.title}</h3>
                  <p className="text-xs text-[#726d6c]">{new Date(moment.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
