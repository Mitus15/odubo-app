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

function getStatusStyles(status: string): { dot: string; glow?: string } {
  switch (status) {
    case 'scheduled':
      return { dot: 'bg-[#843c2d]', glow: 'shadow-[0_0_6px_rgba(212,168,83,0.5)]' };
    case 'published':
      return { dot: 'bg-emerald-400', glow: 'shadow-[0_0_6px_rgba(52,211,153,0.5)]' };
    case 'failed':
      return { dot: 'bg-red-400', glow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]' };
    case 'publishing':
      return { dot: 'bg-purple-400' };
    default:
      return { dot: 'bg-[#726d6c]' };
  }
}

// =============================================================================
// ICONS
// =============================================================================

const Icons = {
  chevronLeft: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  video: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  image: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
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
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-6 pb-4 bg-gradient-to-b from-black via-black to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0d0c0a] border border-[#302927] text-[#726d6c] hover:text-white hover:bg-[#302927] hover:border-[#e8a990]/35 transition-all duration-300"
            >
              {Icons.chevronLeft}
            </button>
            <button
              onClick={goToNext}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#0d0c0a] border border-[#302927] text-[#726d6c] hover:text-white hover:bg-[#302927] hover:border-[#e8a990]/35 transition-all duration-300"
            >
              {Icons.chevronRight}
            </button>
            <h1 className="text-lg font-semibold text-white ml-3 tracking-tight">{headerText}</h1>
          </div>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-xl bg-[#0d0c0a] border border-[#302927] text-xs font-medium text-[#e8a990] hover:bg-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_15px_rgba(212,168,83,0.15)] transition-all duration-300 tracking-wide"
          >
            Today
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1 p-1 bg-black rounded-xl border border-[#302927]">
          {(['week', 'month', 'list'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium tracking-wide transition-all duration-300 ${
                viewMode === mode
                  ? 'bg-gradient-to-r from-[#843c2d] to-[#6b3323] text-black shadow-[0_0_15px_rgba(212,168,83,0.3)]'
                  : 'text-[#726d6c] hover:text-[#726d6c]'
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
                <div key={i} className="text-center text-[10px] text-[#726d6c] py-2 font-medium tracking-widest">
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
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#843c2d] to-[#6b3323] text-black shadow-[0_0_20px_rgba(212,168,83,0.4)]'
                        : dayData?.isToday
                        ? 'bg-[#843c2d]/15 text-[#e8a990] ring-1 ring-[#843c2d]/40'
                        : isCurrentMonth
                        ? 'text-white hover:bg-[#0d0c0a] hover:ring-1 hover:ring-[#302927]'
                        : 'text-[#3a3534]'
                    }`}
                  >
                    <span className={`text-sm font-medium ${viewMode === 'month' ? 'text-xs' : ''}`}>
                      {date.getDate()}
                    </span>

                    {/* Status dots */}
                    {dayData && (dayData.posts.length > 0 || dayData.emptySlots.length > 0) && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {dayData.posts.slice(0, 3).map((post, i) => {
                          const style = getStatusStyles(post.status);
                          return (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-black/60' : style.dot
                              }`}
                            />
                          );
                        })}
                        {dayData.emptySlots.length > 0 && (
                          <div
                            className={`w-1.5 h-1.5 rounded-full border ${
                              isSelected ? 'border-black/40' : 'border-[#726d6c]'
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
          <div className="mb-4 pt-2 border-t border-[#302927]">
            <h2 className={`text-sm font-semibold tracking-wide ${selectedDayData.isToday ? 'text-[#e8a990]' : 'text-white'}`}>
              {selectedDayData.isToday
                ? 'Today'
                : selectedDayData.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
            </h2>
          </div>

          {selectedDayData.posts.length === 0 && selectedDayData.emptySlots.length === 0 ? (
            <div className="p-8 rounded-2xl bg-black border border-[#302927] text-center">
              <div className="w-12 h-12 rounded-xl bg-[#0d0c0a] border border-[#302927] flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl opacity-40">📅</span>
              </div>
              <p className="text-sm text-[#726d6c]">No posts or slots for this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Posts */}
              {selectedDayData.posts.map((post) => {
                const statusStyle = getStatusStyles(post.status);
                return (
                  <button
                    key={post.id}
                    onClick={() => onViewPost(post.id)}
                    className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-black border border-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_25px_rgba(212,168,83,0.08)] transition-all duration-300 text-left"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#0d0c0a] flex-shrink-0 border border-[#302927] group-hover:border-[#e8a990]/25 transition-colors">
                      {post.thumbnail_url ? (
                        <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#3a3534]">
                          {post.media_type === 'video' ? Icons.video : Icons.image}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#e8a990] font-medium">
                          {formatTime(post.scheduled_at!)}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${statusStyle.glow || ''}`} />
                        <span className="text-[10px] text-[#726d6c] uppercase tracking-wide">{post.status}</span>
                      </div>
                      <div className="text-sm text-white truncate mt-1 group-hover:text-[#e8a990] transition-colors">
                        {post.title || post.caption?.slice(0, 40) || 'Untitled'}
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        {post.platforms.slice(0, 3).map((p) => (
                          <span key={p} className="text-xs opacity-70">
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

                    <div className="text-[#3a3534] group-hover:text-[#e8a990] transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </button>
                );
              })}

              {/* Empty Slots */}
              {selectedDayData.emptySlots.map((slot) => (
                <button
                  key={`${selectedDayData.dateStr}-${slot.time}`}
                  onClick={() => onCreateForSlot(selectedDayData.dateStr, slot.time)}
                  className="group w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-[#302927] hover:border-[#843c2d]/40 hover:bg-[#843c2d]/5 transition-all duration-300 text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-black border border-[#302927] flex items-center justify-center flex-shrink-0 group-hover:border-[#e8a990]/35 transition-colors">
                    <span className="text-[#726d6c] group-hover:text-[#e8a990] transition-colors">{Icons.plus}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[#726d6c]">{formatSlotTime(slot.time)}</div>
                    <div className="text-sm text-[#e8a990] mt-0.5 font-medium">+ Add Content</div>
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
            <div className="p-8 rounded-2xl bg-black border border-[#302927] text-center mt-4">
              <div className="w-12 h-12 rounded-xl bg-[#0d0c0a] border border-[#302927] flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl opacity-40">📅</span>
              </div>
              <p className="text-sm text-[#726d6c]">No posts scheduled for the next two weeks</p>
            </div>
          ) : (
            <div className="space-y-6">
              {listDays.map((dayData) => (
                <div key={dayData.dateStr}>
                  <h3
                    className={`text-xs font-semibold uppercase tracking-widest mb-3 ${
                      dayData.isToday ? 'text-[#e8a990]' : 'text-[#726d6c]'
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
                    {dayData.posts.map((post) => {
                      const statusStyle = getStatusStyles(post.status);
                      return (
                        <button
                          key={post.id}
                          onClick={() => onViewPost(post.id)}
                          className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-black border border-[#302927] hover:border-[#e8a990]/35 hover:shadow-[0_0_25px_rgba(212,168,83,0.08)] transition-all duration-300 text-left"
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#0d0c0a] flex-shrink-0 border border-[#302927] group-hover:border-[#e8a990]/25 transition-colors">
                            {post.thumbnail_url ? (
                              <img
                                src={post.thumbnail_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[#3a3534]">
                                {post.media_type === 'video' ? Icons.video : Icons.image}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#e8a990] font-medium">
                                {formatTime(post.scheduled_at!)}
                              </span>
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${statusStyle.glow || ''}`}
                              />
                            </div>
                            <div className="text-sm text-white truncate mt-1 group-hover:text-[#e8a990] transition-colors">
                              {post.title || post.caption?.slice(0, 40) || 'Untitled'}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {post.platforms.slice(0, 2).map((p) => (
                              <span key={p} className="text-sm opacity-70">
                                {PLATFORM_ICONS[p] || '📱'}
                              </span>
                            ))}
                          </div>

                          <div className="text-[#3a3534] group-hover:text-[#e8a990] transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}

                    {/* Empty Slots */}
                    {dayData.emptySlots.map((slot) => (
                      <button
                        key={`${dayData.dateStr}-${slot.time}`}
                        onClick={() => onCreateForSlot(dayData.dateStr, slot.time)}
                        className="group w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed border-[#302927] hover:border-[#843c2d]/40 hover:bg-[#843c2d]/5 transition-all duration-300 text-left"
                      >
                        <div className="w-12 h-12 rounded-xl bg-black border border-[#302927] flex items-center justify-center flex-shrink-0 group-hover:border-[#e8a990]/35 transition-colors">
                          <span className="text-[#726d6c] group-hover:text-[#e8a990] transition-colors">{Icons.plus}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-[#726d6c]">{formatSlotTime(slot.time)}</div>
                          <div className="text-sm text-[#e8a990] mt-0.5 font-medium">+ Add Content</div>
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
