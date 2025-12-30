'use client';

import { useState, useEffect } from 'react';

interface Entity {
  id: string;
  name: string;
  slug: string;
}

interface PostStats {
  total: number;
  published: number;
  scheduled: number;
  drafts: number;
  failed: number;
}

export default function SocialAnalyticsTab() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [stats, setStats] = useState<PostStats>({ total: 0, published: 0, scheduled: 0, drafts: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  // Fetch entities
  useEffect(() => {
    const loadEntities = async () => {
      try {
        const res = await fetch('/api/entities');
        const data = await res.json() as { entities?: Entity[] };
        setEntities(data.entities || []);
        if (data.entities && data.entities.length > 0 && !selectedEntity) {
          setSelectedEntity(data.entities[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch entities:', err);
      }
    };
    loadEntities();
  }, [selectedEntity]);

  // Fetch post stats for selected entity
  useEffect(() => {
    if (!selectedEntity) return;
    setLoading(true);

    const fetchStats = async () => {
      try {
        // Fetch all posts for this entity
        const res = await fetch(`/api/social/posts?entity_id=${selectedEntity}&limit=1000`);
        const data: { posts?: Array<{ status: string }> } = await res.json();
        const posts = data.posts || [];

        // Calculate stats
        const newStats: PostStats = {
          total: posts.length,
          published: posts.filter(p => p.status === 'published').length,
          scheduled: posts.filter(p => p.status === 'scheduled').length,
          drafts: posts.filter(p => p.status === 'draft').length,
          failed: posts.filter(p => p.status === 'failed').length,
        };
        setStats(newStats);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedEntity]);

  const statCards = [
    { label: 'Total Posts', value: stats.total, color: '#843c2d', icon: '📊' },
    { label: 'Published', value: stats.published, color: '#22c55e', icon: '✅' },
    { label: 'Scheduled', value: stats.scheduled, color: '#3b82f6', icon: '📅' },
    { label: 'Drafts', value: stats.drafts, color: '#f59e0b', icon: '📝' },
    { label: 'Failed', value: stats.failed, color: '#ef4444', icon: '❌' },
  ];

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#ede8df]">Social Analytics</h1>
        <p className="text-sm text-[#726d6c] mt-1">
          Track your social media performance across platforms
        </p>
      </div>

      {/* Entity Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#b2a491] mb-2">Entity</label>
        <div className="flex gap-2">
          {entities.map(entity => (
            <button
              key={entity.id}
              onClick={() => setSelectedEntity(entity.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedEntity === entity.id
                  ? 'bg-[#843c2d] text-white'
                  : 'bg-[#1a1816] text-[#726d6c] hover:text-[#b2a491] border border-[#302927]'
              }`}
            >
              {entity.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#502d26]/30 border-t-[#843c2d] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {statCards.map(card => (
              <div
                key={card.label}
                className="p-4 bg-[#1a1816] rounded-xl border border-[#302927]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{card.icon}</span>
                  <span className="text-xs text-[#726d6c] uppercase tracking-wide">{card.label}</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: card.color }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Coming Soon Section */}
          <div className="p-8 bg-[#1a1816] rounded-xl border border-[#302927] text-center">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-lg font-medium text-[#ede8df] mb-2">Advanced Analytics Coming Soon</h3>
            <p className="text-sm text-[#726d6c] max-w-md mx-auto">
              Engagement metrics, reach analytics, best posting times, and performance comparisons
              will be available once we integrate with platform APIs.
            </p>
          </div>

          {/* Quick Insights */}
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#302927]/30 rounded-xl border border-[#502d26]/20">
              <h4 className="text-sm font-medium text-[#b2a491] mb-3">Publishing Rate</h4>
              <div className="text-3xl font-bold text-[#ede8df] mb-1">
                {stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0}%
              </div>
              <p className="text-xs text-[#726d6c]">
                {stats.published} of {stats.total} posts published
              </p>
            </div>
            <div className="p-4 bg-[#302927]/30 rounded-xl border border-[#502d26]/20">
              <h4 className="text-sm font-medium text-[#b2a491] mb-3">Success Rate</h4>
              <div className="text-3xl font-bold text-[#ede8df] mb-1">
                {stats.total > 0 ? Math.round(((stats.total - stats.failed) / stats.total) * 100) : 100}%
              </div>
              <p className="text-xs text-[#726d6c]">
                {stats.failed} failed out of {stats.total} posts
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
