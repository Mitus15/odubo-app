'use client';

import { useState, useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

type CalendarMode = 'week' | 'month' | 'list';
type PostStatus = 'draft' | 'pending_approval' | 'scheduled' | 'publishing' | 'published' | 'failed';

interface ScheduledPost {
  id: string;
  status: PostStatus;
  title?: string;
  caption?: string;
  media_type: 'video' | 'image' | 'carousel';
  thumbnail_url?: string;
  platforms: string[];
  scheduled_at?: string;
  published_at?: string;
}

interface CalendarViewProps {
  posts: ScheduledPost[];
  onPostClick?: (post: ScheduledPost) => void;
  onCreatePost?: (date: Date) => void;
}

// Platform config
const PLATFORM_CONFIG: Record<string, { icon: string; color: string }> = {
  tiktok: { icon: '📱', color: '#00f2ea' },
  instagram: { icon: '📷', color: '#E4405F' },
  youtube: { icon: '▶️', color: '#FF0000' },
  facebook: { icon: '👤', color: '#1877F2' },
  threads: { icon: '🧵', color: '#000000' },
};

// =============================================================================
// HELPERS
// =============================================================================

function getWeekDays(baseDate: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(baseDate);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const days: (Date | null)[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Add empty slots for days before the first day
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getStatusColor(status: PostStatus): string {
  switch (status) {
    case 'scheduled': return 'bg-blue-500';
    case 'published': return 'bg-green-500';
    case 'failed': return 'bg-red-500';
    case 'pending_approval': return 'bg-amber-500';
    case 'publishing': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CalendarView({ posts, onPostClick, onCreatePost }: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#502d26]/20">
        <div className="flex items-center gap-2">
          {(['week', 'month', 'list'] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-[#843c2d] text-white'
                  : 'bg-[#171616] text-[#726d6c] hover:text-[#ede8df]'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {mode !== 'list' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => mode === 'week' ? navigateWeek(-1) : navigateMonth(-1)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="min-h-[44px] px-4 rounded-lg text-sm text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927]"
            >
              Today
            </button>

            <button
              onClick={() => mode === 'week' ? navigateWeek(1) : navigateMonth(1)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#726d6c] hover:text-[#ede8df] hover:bg-[#302927]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {mode === 'week' && (
          <WeekView
            currentDate={currentDate}
            posts={posts}
            onPostClick={onPostClick}
            onCreatePost={onCreatePost}
          />
        )}
        {mode === 'month' && (
          <MonthView
            currentDate={currentDate}
            posts={posts}
            onPostClick={onPostClick}
            onCreatePost={onCreatePost}
          />
        )}
        {mode === 'list' && (
          <ListView
            posts={posts}
            onPostClick={onPostClick}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// WEEK VIEW
// =============================================================================

function WeekView({
  currentDate,
  posts,
  onPostClick,
  onCreatePost,
}: {
  currentDate: Date;
  posts: ScheduledPost[];
  onPostClick?: (post: ScheduledPost) => void;
  onCreatePost?: (date: Date) => void;
}) {
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const today = new Date();

  const postsByDay = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    posts.forEach((post) => {
      if (post.scheduled_at) {
        const date = new Date(post.scheduled_at);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(post);
      }
    });
    // Sort by time
    Object.values(map).forEach((dayPosts) => {
      dayPosts.sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    });
    return map;
  }, [posts]);

  return (
    <div className="p-4">
      {/* Week Header */}
      <div className="text-center mb-4">
        <p className="text-sm text-[#726d6c]">
          {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayPosts = postsByDay[key] || [];
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;

          return (
            <div
              key={key}
              className={`min-h-[120px] rounded-xl border transition-colors ${
                isToday
                  ? 'border-[#843c2d] bg-[#843c2d]/5'
                  : isPast
                  ? 'border-[#502d26]/10 bg-[#171616]/50 opacity-60'
                  : 'border-[#502d26]/20 bg-[#171616]'
              }`}
            >
              {/* Day Header */}
              <div className="p-2 border-b border-[#502d26]/10">
                <p className={`text-xs font-medium ${isToday ? 'text-[#843c2d]' : 'text-[#726d6c]'}`}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <p className={`text-lg font-semibold ${isToday ? 'text-[#ede8df]' : 'text-[#726d6c]'}`}>
                  {day.getDate()}
                </p>
              </div>

              {/* Posts */}
              <div className="p-1.5 space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    onClick={() => onPostClick?.(post)}
                    className="w-full p-1.5 rounded-lg bg-[#302927]/50 hover:bg-[#302927] text-left transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(post.status)}`} />
                      <span className="text-[10px] text-[#726d6c]">
                        {formatTime(new Date(post.scheduled_at!))}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#ede8df] truncate mt-0.5">
                      {post.title || post.caption?.slice(0, 20) || 'Untitled'}
                    </p>
                  </button>
                ))}
                {dayPosts.length > 3 && (
                  <p className="text-[10px] text-[#726d6c] text-center">
                    +{dayPosts.length - 3} more
                  </p>
                )}
                {dayPosts.length === 0 && !isPast && (
                  <button
                    onClick={() => onCreatePost?.(day)}
                    className="w-full p-2 rounded-lg border border-dashed border-[#502d26]/30 text-[10px] text-[#726d6c] hover:text-[#ede8df] hover:border-[#502d26] transition-colors"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// MONTH VIEW
// =============================================================================

function MonthView({
  currentDate,
  posts,
  onPostClick,
  onCreatePost,
}: {
  currentDate: Date;
  posts: ScheduledPost[];
  onPostClick?: (post: ScheduledPost) => void;
  onCreatePost?: (date: Date) => void;
}) {
  const monthDays = useMemo(
    () => getMonthDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate]
  );
  const today = new Date();

  const postsByDay = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    posts.forEach((post) => {
      if (post.scheduled_at) {
        const date = new Date(post.scheduled_at);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(post);
      }
    });
    return map;
  }, [posts]);

  return (
    <div className="p-4">
      {/* Month Header */}
      <div className="text-center mb-4">
        <p className="text-lg font-semibold">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs text-[#726d6c] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayPosts = postsByDay[key] || [];
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;

          return (
            <button
              key={key}
              onClick={() => dayPosts.length > 0 ? onPostClick?.(dayPosts[0]) : onCreatePost?.(day)}
              className={`aspect-square rounded-lg p-1 text-left transition-colors ${
                isToday
                  ? 'bg-[#843c2d]/20 ring-1 ring-[#843c2d]'
                  : isPast
                  ? 'bg-[#171616]/30 opacity-50'
                  : 'bg-[#171616] hover:bg-[#302927]'
              }`}
            >
              <p className={`text-xs ${isToday ? 'text-[#843c2d] font-semibold' : 'text-[#726d6c]'}`}>
                {day.getDate()}
              </p>
              {dayPosts.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {dayPosts.slice(0, 3).map((post, j) => (
                    <div
                      key={j}
                      className={`w-1.5 h-1.5 rounded-full ${getStatusColor(post.status)}`}
                      title={post.title || 'Post'}
                    />
                  ))}
                  {dayPosts.length > 3 && (
                    <span className="text-[8px] text-[#726d6c]">+{dayPosts.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-[#726d6c]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Scheduled
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Published
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// LIST VIEW
// =============================================================================

function ListView({
  posts,
  onPostClick,
}: {
  posts: ScheduledPost[];
  onPostClick?: (post: ScheduledPost) => void;
}) {
  // Group posts by date, sorted by scheduled_at
  const groupedPosts = useMemo(() => {
    const scheduled = posts
      .filter((p) => p.scheduled_at && ['scheduled', 'pending_approval'].includes(p.status))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

    const groups: { date: string; posts: ScheduledPost[] }[] = [];
    let currentDate = '';

    scheduled.forEach((post) => {
      const date = new Date(post.scheduled_at!).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      if (date !== currentDate) {
        groups.push({ date, posts: [] });
        currentDate = date;
      }
      groups[groups.length - 1].posts.push(post);
    });

    return groups;
  }, [posts]);

  if (groupedPosts.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#726d6c]">No scheduled posts</p>
        <p className="text-sm text-[#726d6c]/70 mt-1">Create a post to see it here</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {groupedPosts.map((group) => (
        <div key={group.date}>
          <h3 className="text-sm font-medium text-[#726d6c] mb-3">{group.date}</h3>
          <div className="space-y-2">
            {group.posts.map((post) => (
              <button
                key={post.id}
                onClick={() => onPostClick?.(post)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#171616] border border-[#502d26]/20 hover:border-[#502d26]/40 text-left transition-colors"
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#302927] flex-shrink-0">
                  {post.thumbnail_url ? (
                    <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">
                      {post.media_type === 'video' ? '🎬' : '📷'}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {post.title || post.caption?.slice(0, 40) || 'Untitled'}
                    </p>
                    {post.status === 'pending_approval' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-900/30 text-amber-400">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {/* Time */}
                    <span className="text-xs text-[#726d6c]">
                      {new Date(post.scheduled_at!).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {/* Platforms */}
                    <span className="text-xs">
                      {post.platforms.map((p) => PLATFORM_CONFIG[p]?.icon || '📱').join('')}
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-[#726d6c]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default CalendarView;
