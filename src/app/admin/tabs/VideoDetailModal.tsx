import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface Video {
  id: number;
  uid: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  duration: string | null;
  category: string | null;
  mood: string | null;
  type: string | null;
  artist_name: string | null;
  is_public: number | null;
  publication_status: string | null;
}

const getVideoUid = (video: Video) => {
  if (video.uid) return video.uid;
  return '';
};

const parseTimeToSeconds = (time: string | number | undefined | null): number | null => {
  if (time === undefined || time === null || time === '') return null;
  if (typeof time === 'number') return isFinite(time) ? time : null;
  const trimmed = time.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const parts = trimmed.split(':').map(p => p.trim()).filter(Boolean);
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));
    if (nums.length !== parts.length) return null;
    const [hOrM, mOrS, maybeS] = nums;
    if (parts.length === 2) return hOrM * 60 + mOrS;
    return hOrM * 3600 + mOrS * 60 + (maybeS || 0);
  }
  return null;
};

const formatDuration = (duration?: string | number) => {
  if (!duration) return '';
  if (typeof duration === 'string' && duration.includes(':')) return duration;
  const seconds = typeof duration === 'string' ? parseFloat(duration) : duration;
  if (isNaN(seconds)) return String(duration);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
};

const ThumbnailPicker = ({ 
  video, 
  onPosterSet, 
  currentPoster 
}: { 
  video: Video; 
  onPosterSet: (seconds: number) => Promise<void>; 
  currentPoster?: string | null;
}) => {
  const [customTime, setCustomTime] = useState('');
  const [settingTime, setSettingTime] = useState<number | null>(null);

  const uid = getVideoUid(video);
  const durationSeconds = useMemo(() => parseTimeToSeconds(video.duration) || null, [video.duration]);

  const suggestedTimes = useMemo(() => {
    const times: number[] = [];

    if (durationSeconds && durationSeconds > 0) {
      const fractions = [0.05, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
      fractions.forEach(f => times.push(Math.max(0, Math.min(durationSeconds, parseFloat((durationSeconds * f).toFixed(2))))));
    } else {
      times.push(5, 15, 30, 45, 60);
    }

    const unique = Array.from(new Set(times.map(t => parseFloat(t.toFixed(2)))));
    unique.sort((a, b) => a - b);
    return unique;
  }, [durationSeconds]);

  const thumbnailUrls = useMemo(() => {
    if (!uid) return [] as { time: number; url: string }[];
    return suggestedTimes.map(time => ({
      time,
      url: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=${time}s&height=720`
    }));
  }, [suggestedTimes, uid]);

  const handleSetPoster = async (time: number) => {
    setSettingTime(time);
    try {
      await onPosterSet(time);
    } finally {
      setSettingTime(null);
    }
  };

  const handleCustomSubmit = async () => {
    const parsed = parseTimeToSeconds(customTime);
    if (parsed === null) {
      alert('Enter a valid timestamp (seconds or mm:ss)');
      return;
    }
    await handleSetPoster(parsed);
    setCustomTime('');
  };

  if (!uid) {
    return (
      <div className="text-sm text-[#b2a491]">No Cloudflare UID found for this video.</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs text-[#b2a491] mb-1">Custom Timestamp</label>
          <div className="flex gap-2">
            <input
              value={customTime}
              onChange={e => setCustomTime(e.target.value)}
              placeholder="e.g. 45 or 1:05"
              className="flex-1 bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-3 py-2 text-[#ede8df] text-sm focus:outline-none focus:border-[#ede8df]"
            />
            <button
              onClick={handleCustomSubmit}
              className="px-4 py-2 bg-[#302927] text-[#ede8df] rounded-lg text-sm hover:bg-[#302927]/80"
              disabled={settingTime !== null}
            >Set Poster</button>
          </div>
        </div>
        {currentPoster && (
          <div className="w-36 text-xs text-[#b2a491]">
            <div className="mb-1">Current Poster</div>
            <img src={currentPoster} className="w-full aspect-video object-cover rounded border border-[#b2a491]/20" alt="Current poster" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {thumbnailUrls.map(item => (
          <div key={item.time} className={`relative rounded-lg overflow-hidden border ${currentPoster && currentPoster.includes(`time=${item.time}`) ? 'border-[#ede8df]' : 'border-[#b2a491]/20'} bg-[#000]/20`}>
            <img src={item.url} className="w-full aspect-video object-cover" alt={`Frame at ${item.time}s`} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between text-xs text-[#ede8df]">
              <span>{formatDuration(item.time)}</span>
              <button
                onClick={() => handleSetPoster(item.time)}
                disabled={settingTime === item.time}
                className="text-[11px] px-2 py-1 rounded bg-[#ede8df] text-[#171616] hover:bg-[#d9d3c9]"
              >{settingTime === item.time ? 'Setting...' : 'Use'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export function VideoDetailModal({
  video,
  onClose,
  onUpdate,
}: {
  video: Video;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'thumbnails'>('details');
  const [posterUrl, setPosterUrl] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    title: video.title || '',
    description: video.description || '',
    duration: video.duration || '',
    artist_name: video.artist_name || '',
    category: video.category || 'music',
    mood: video.mood || '',
    type: video.type || 'music-video',
    is_public: video.is_public === 1,
  });

  const videoWithPoster = { ...video, poster_url: posterUrl || video.poster_url };

  useEffect(() => {
    setPosterUrl(video.poster_url || undefined);
  }, [video.id, video.poster_url]);

  const handleSave = async () => {
    try {
      const saveData = {
        ...formData,
        poster_url: posterUrl,
        status: 'published',
        publication_status: formData.is_public ? 'live' : 'archived'
      };
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData)
      });

      if (!res.ok) {
        const data: any = await res.json();
        throw new Error(data.error || 'Failed to update video');
      }

      await onUpdate();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    }
  };

  const handleSetPosterFromTime = async (time: number) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_poster_from_time: time }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed to set poster');
      }
      
      const uid = getVideoUid(videoWithPoster);
      const newUrl = uid ? `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=${time}s` : videoWithPoster.poster_url;
      setPosterUrl(newUrl || undefined);
      
      void onUpdate();
    } catch (e: any) {
      console.error('Failed to set poster:', e);
      if (e.name === 'AbortError') {
        alert('Request timed out. Please try again.');
      } else {
        alert(e.message || 'Failed to set poster');
      }
    }
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          layoutId={`card-${video.id}`}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#171616] rounded-2xl border border-[#b2a491]/20 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-[#b2a491]/10 flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-[#ede8df]">{video.title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#302927] transition-colors text-[#b2a491] hover:text-[#ede8df]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-[#b2a491]/10 scrollbar-hide">
            <button onClick={() => setActiveTab('details')} className={`flex-1 min-w-[100px] min-h-[48px] py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'details' ? 'text-[#ede8df] border-b-2 border-[#ede8df]' : 'text-[#b2a491]'}`}>Details</button>
            <button onClick={() => setActiveTab('thumbnails')} className={`flex-1 min-w-[100px] min-h-[48px] py-3 text-sm font-medium whitespace-nowrap ${activeTab === 'thumbnails' ? 'text-[#ede8df] border-b-2 border-[#ede8df]' : 'text-[#b2a491]'}`}>Thumbnails</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === 'details' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Title</label>
                  <input 
                    value={formData.title} 
                    onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Artist Name</label>
                  <input 
                    value={formData.artist_name} 
                    onChange={e => setFormData(f => ({ ...f, artist_name: e.target.value }))}
                    placeholder="e.g. The Weeknd"
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#b2a491] mb-1">Description</label>
                  <textarea 
                    value={formData.description} 
                    onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-[#302927]/30 border border-[#b2a491]/20 rounded-lg px-4 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                  />
                </div>

                <div className="bg-[#302927]/20 rounded-lg p-4 border border-[#b2a491]/10 space-y-3">
                  <h3 className="text-xs font-medium text-[#b2a491] uppercase tracking-wider">Visibility</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#b2a491] mb-1">Type</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData(f => ({ ...f, type: e.target.value, category: e.target.value }))}
                        className="w-full bg-[#302927]/50 border border-[#b2a491]/20 rounded-lg px-3 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                      >
                        <option value="music-video">Music Video</option>
                        <option value="behind-the-scenes">Behind the Scenes</option>
                        <option value="live-performance">Live Performance</option>
                        <option value="interview">Interview</option>
                        <option value="documentary">Documentary</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#b2a491] mb-1">Mood</label>
                      <input 
                        value={formData.mood} 
                        onChange={e => setFormData(f => ({ ...f, mood: e.target.value }))}
                        placeholder="e.g. Energetic, Dark, Chill"
                        className="w-full bg-[#302927]/50 border border-[#b2a491]/20 rounded-lg px-3 py-2 text-[#ede8df] focus:outline-none focus:border-[#ede8df]"
                      />
                    </div>
                    <div className="col-span-2 flex items-center pt-2">
                      <label className="flex items-center gap-3 cursor-pointer select-none w-full">
                        <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${formData.is_public ? 'bg-green-500/80' : 'bg-[#302927] border border-[#b2a491]/20'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${formData.is_public ? 'translate-x-5' : ''}`} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-[#ede8df]">Publicly Visible</span>
                          <span className="text-[10px] text-[#b2a491]">Show on media & clips</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={formData.is_public} 
                          onChange={e => setFormData(f => ({ ...f, is_public: e.target.checked }))}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'thumbnails' ? (
              <div className="space-y-4">
                <h3 className="text-[#ede8df] font-medium">Choose Thumbnail</h3>
                <ThumbnailPicker
                  video={videoWithPoster}
                  onPosterSet={handleSetPosterFromTime}
                  currentPoster={posterUrl || videoWithPoster.poster_url || null}
                />
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#b2a491]/10 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[#b2a491] hover:bg-[#302927]">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-[#ede8df] text-[#171616] font-medium hover:bg-[#d9d3c9]">Save Changes</button>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}
