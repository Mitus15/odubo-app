'use client';

import { useState, useMemo } from 'react';
import type { Post, PostingSlot } from '../page';

// =============================================================================
// TYPES
// =============================================================================

interface CalendarViewProps {
  posts: Post[];
  slots: PostingSlot[];
  onViewPost: (postId: string) => void;
  onCreateForSlot: (date: string, time: string) => void;
}

type ViewMode = 'week' | 'month' | 'list';

interface DayData {
  date: Date;
  dateStr: string;
  isToday: boolean;
  isPast: boolean;
  posts: Post[];
  emptySlots: { time: string; slotId: string }[];
}

// =============================================================================
// PLATFORM ICONS
// =============================================================================

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📷',
  tiktok: '📱',
  youtube: '▶️',
  facebook: '👤',
  threads: '🧵',
  twitter: '🐦',
  linkedin: '💼',
  pinterest: '📌',
  bluesky: '🦋',
};

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatSlotTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getWeekDays(referenceDate: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(referenceDate);
  // Start from Sunday of current week
  start.setDate(start.getDate() - start.getDay());

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Add days from previous month to fill the week
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    const day = new Date(year, month, -i);
    days.push(day);
  }

  // Add all days of current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Add days from next month to complete the grid
  const endPadding = 42 - days.length; // 6 rows × 7 days
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

function getStatusDot(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500';
    case 'published':
      return 'bg-emerald-500';
    case 'failed':
      return 'bg-red-500';
    case 'publishing':
      return 'bg-purple-500';
    default:
      return 'bg-[#726d6c]';
  }
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  chevronLeft: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CalendarView({
  posts,
  slots,
  onViewPost,
  onCreateForSlot,
}: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const today = useMemo(() => new Date(), []);
  const activeSlots = useMemo(() => slots.filter((s) => s.is_active), [slots]);

  // Generate days for current view
  const days = useMemo(() => {
    if (viewMode === 'week') {
      return getWeekDays(currentDate);
    } else if (viewMode === 'month') {
      return getMonthDays(currentDate.getFullYear(), currentDate.getMonth());
    }
    return [];
  }, [viewMode, currentDate]);

  // Build day data with posts and empty slots
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    days.forEach((date) => {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const isPast = dayStart < todayStart;
      const isToday = isSameDay(date, today);

      // Get posts for this day
      const dayPosts = posts.filter((p) => {
        if (!p.scheduled_at) return false;
        const postDate = new Date(p.scheduled_at);
        return isSameDay(postDate, date);
      });

      // Calculate empty slots
      const emptySlots: { time: string; slotId: string }[] = [];
      if (!isPast) {
        activeSlots.forEach((slot) => {
          // Check if slot applies to this day
          const slotApplies = slot.day_of_week === null || slot.day_of_week === dayOfWeek;
          if (!slotApplies) return;

          // Check if there's already a post at this time
          const hasPost = dayPosts.some((p) => {
            if (!p.scheduled_at) return false;
            const postTime = new Date(p.scheduled_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            });
            return postTime === slot.time;
          });

          if (!hasPost) {
            emptySlots.push({ time: slot.time, slotId: slot.id });
          }
        });
      }

      map.set(dateStr, {
        date,
        dateStr,
        isToday,
        isPast,
        posts: dayPosts.sort(
          (a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
        ),
        emptySlots: emptySlots.sort((a, b) => a.time.localeCompare(b.time)),
      });
    });

    return map;
  }, [days, posts, activeSlots, today]);

  // Get list of days with content for list view
  const listDays = useMemo(() => {
    if (viewMode !== 'list') return [];

    const result: DayData[] = [];
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    for (let i = 0; i < 14; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = dayDataMap.get(dateStr);
      if (dayData && (dayData.posts.length > 0 || dayData.emptySlots.length > 0)) {
        result.push(dayData);
      }
    }

    return result;
  }, [viewMode, currentDate, dayDataMap]);

  // Navigation handlers
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Get header text
  const headerText = useMemo(() => {
    if (viewMode === 'week') {
      const weekStart = days[0];
      const weekEnd = days[6];
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return weekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      return `${weekStart.toLocaleDateString('en-US', { month: 'short' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [viewMode, currentDate, days]);

  // Get selected day data
  const selectedDayData = selectedDate
    ? dayDataMap.get(selectedDate.toISOString().split('T')[0])
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1a1a1a] text-white hover:bg-[#252525] transition-colors"
            >
              {Icons.chevronLeft}
            </button>
            <button
              onClick={goToNext}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1a1a1a] text-white hover:bg-[#252525] transition-colors"
            >
              {Icons.chevronRight}
            </button>
            <h1 className="text-lg font-semibold text-white ml-2">{headerText}</h1>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-sm text-[#D4A853] hover:bg-[#252525] transition-colors"
          >
            Today
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1 p-1 bg-[#1a1a1a] rounded-xl">
          {(['week', 'month', 'list'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-[#D4A853] text-black'
                  : 'text-[#726d6c] hover:text-white'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Content */}
      {viewMode !== 'list' && (
        <>
          {/* Day Headers */}
          <div className="flex-shrink-0 px-4">
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center text-xs text-[#726d6c] py-2">
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-shrink-0 px-4 pb-3">
            <div className={`grid grid-cols-7 gap-1 ${viewMode === 'month' ? '' : ''}`}>
              {days.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayData = dayDataMap.get(dateStr);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(date)}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-[#D4A853] text-black'
                        : dayData?.isToday
                        ? 'bg-[#D4A853]/20 text-[#D4A853]'
                        : isCurrentMonth
                        ? 'text-white hover:bg-[#1a1a1a]'
                        : 'text-[#726d6c]/50'
                    }`}
                  >
                    <span className={`text-sm ${viewMode === 'month' ? 'text-xs' : ''}`}>
                      {date.getDate()}
                    </span>

                    {/* Status dots */}
                    {dayData && (dayData.posts.length > 0 || dayData.emptySlots.length > 0) && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {dayData.posts.slice(0, 3).map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 h-1 rounded-full ${
                              isSelected ? 'bg-black/60' : 'bg-blue-500'
                            }`}
                          />
                        ))}
                        {dayData.emptySlots.length > 0 && (
                          <div
                            className={`w-1 h-1 rounded-full ${
                              isSelected ? 'bg-black/40' : 'bg-[#726d6c]/50'
                            }`}
                          />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Day Details (Week/Month view) */}
      {viewMode !== 'list' && selectedDayData && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-white">
              {selectedDayData.date.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h2>
          </div>

          {selectedDayData.posts.length === 0 && selectedDayData.emptySlots.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#1a1a1a] border border-[#252525] text-center">
              <p className="text-sm text-[#726d6c]">No posts or slots for this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Posts */}
              {selectedDayData.posts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onViewPost(post.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#252525] flex-shrink-0">
                    {post.thumbnail_url ? (
                      <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        {post.media_type === 'video' ? '🎬' : '📷'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#D4A853] font-medium">
                        {formatTime(post.scheduled_at!)}
                      </span>
                      <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot(post.status)}`} />
                      <span className="text-xs text-[#726d6c] capitalize">{post.status}</span>
                    </div>
                    <div className="text-sm text-white truncate mt-0.5">
                      {post.title || post.caption?.slice(0, 40) || 'Untitled'}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {post.platforms.slice(0, 3).map((p) => (
                        <span key={p} className="text-xs">
                          {PLATFORM_ICONS[p] || '📱'}
                        </span>
                      ))}
                      {post.platforms.length > 3 && (
                        <span className="text-[10px] text-[#726d6c]">
                          +{post.platforms.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {/* Empty Slots */}
              {selectedDayData.emptySlots.map((slot) => (
                <button
                  key={`${selectedDayData.dateStr}-${slot.time}`}
                  onClick={() => onCreateForSlot(selectedDayData.dateStr, slot.time)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#726d6c]">{Icons.plus}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#726d6c]">{formatSlotTime(slot.time)}</div>
                    <div className="text-sm text-[#D4A853] mt-0.5">+ Add Content</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {listDays.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#1a1a1a] border border-[#252525] text-center mt-4">
              <p className="text-sm text-[#726d6c]">No posts scheduled for the next two weeks</p>
            </div>
          ) : (
            <div className="space-y-4">
              {listDays.map((dayData) => (
                <div key={dayData.dateStr}>
                  <h3
                    className={`text-sm font-semibold mb-2 ${
                      dayData.isToday ? 'text-[#D4A853]' : 'text-white'
                    }`}
                  >
                    {dayData.isToday
                      ? 'Today'
                      : dayData.date.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                  </h3>

                  <div className="space-y-2">
                    {/* Posts */}
                    {dayData.posts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => onViewPost(post.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#252525] flex-shrink-0">
                          {post.thumbnail_url ? (
                            <img
                              src={post.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">
                              {post.media_type === 'video' ? '🎬' : '📷'}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#D4A853] font-medium">
                              {formatTime(post.scheduled_at!)}
                            </span>
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${getStatusDot(post.status)}`}
                            />
                          </div>
                          <div className="text-sm text-white truncate mt-0.5">
                            {post.title || post.caption?.slice(0, 40) || 'Untitled'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {post.platforms.slice(0, 2).map((p) => (
                            <span key={p} className="text-sm">
                              {PLATFORM_ICONS[p] || '📱'}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}

                    {/* Empty Slots */}
                    {dayData.emptySlots.map((slot) => (
                      <button
                        key={`${dayData.dateStr}-${slot.time}`}
                        onClick={() => onCreateForSlot(dayData.dateStr, slot.time)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-[#252525] hover:border-[#D4A853]/30 transition-colors text-left"
                      >
                        <div className="w-12 h-12 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                          <span className="text-[#726d6c]">{Icons.plus}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#726d6c]">{formatSlotTime(slot.time)}</div>
                          <div className="text-sm text-[#D4A853] mt-0.5">+ Add Content</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
