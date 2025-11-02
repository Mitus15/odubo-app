"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// Data types - unified concept treating galleries as events
type MomentsEvent = {
  id: string;
  title: string;
  code: string;
  description?: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by?: string;
  created_at?: string;
  config?: {
    featured?: boolean;
    persistent?: boolean;
    capacity?: number;
    ticket_price?: number;
    is_public?: boolean;
  };
  // Stats from gallery_photos
  photo_count?: number;
  video_count?: number;
};

export default function MomentsTab() {
  const [events, setEvents] = useState<MomentsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const featuredCount = useMemo(() => events.filter(e => e.config?.featured).length, [events]);

  // Copy code helper
  function copyCode(code: string) {
    navigator.clipboard?.writeText(code);
    alert(`Code copied: ${code}`);
  }

  // Toggle featured status
  async function toggleFeatured(eventId: string) {
    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;
      
      const newFeatured = !event.config?.featured;
      const updatedConfig = { ...event.config, featured: newFeatured };
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/moments/galleries/${eventId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ config: updatedConfig })
      });
      
      if (!res.ok) throw new Error('Failed to update');
      
      setEvents(prev => prev.map(e => 
        e.id === eventId 
          ? { ...e, config: updatedConfig }
          : e
      ));
    } catch (e) {
      console.error('Toggle featured error:', e);
      alert('Failed to update featured status');
    }
  }

  // Load events (galleries)
  useEffect(() => {
    let cancelled = false;
    
    async function loadEvents() {
      setLoading(true);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch('/api/moments/galleries?limit=50', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store'
        });
        
        if (!res.ok) throw new Error('Failed to load events');
        
        const data: any = await res.json();
        if (cancelled) return;
        
        const mapped: MomentsEvent[] = (data.galleries || []).map((g: any) => {
          const config = typeof g.config === 'string' 
            ? (JSON.parse(g.config || '{}') || {})
            : (g.config || {});
          
          return {
            id: String(g.id),
            title: g.title,
            code: g.code,
            description: g.description,
            starts_at: g.starts_at,
            ends_at: g.ends_at,
            created_by: g.created_by,
            created_at: g.created_at,
            config,
            photo_count: g.photo_count || 0,
            video_count: g.video_count || 0
          };
        });
        
        setEvents(mapped);
      } catch (e) {
        console.error('Load events error:', e);
      } finally {
        setLoading(false);
      }
    }
    
    loadEvents();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[#3b3733] rounded w-1/3 mb-4"></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-48 bg-[#3b3733] rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#ede8df]">Moments Events</h2>
          <p className="text-sm text-[#b2a491]">
            Create and manage event galleries for photo/video collection. Featured count: {featuredCount}
          </p>
        </div>
        <CreateEventButton onCreate={async (event) => {
          try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const res = await fetch('/api/moments/create', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                ...(token ? { Authorization: `Bearer ${token}` } : {}) 
              },
              body: JSON.stringify({
                title: event.title,
                code: event.code,
                description: event.description,
                starts_at: event.starts_at,
                ends_at: event.config?.persistent ? null : event.ends_at,
                config: {
                  featured: !!event.config?.featured,
                  persistent: !!event.config?.persistent,
                  capacity: event.config?.capacity,
                  ticket_price: event.config?.ticket_price,
                  is_public: event.config?.is_public !== false
                }
              })
            });
            
            if (!res.ok) throw new Error('Create failed');
            
            // Refresh list
            const listRes = await fetch('/api/moments/galleries?limit=50', {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              cache: 'no-store'
            });
            const data: any = await listRes.json();
            const mapped: MomentsEvent[] = (data.galleries || []).map((g: any) => {
              const config = typeof g.config === 'string' 
                ? (JSON.parse(g.config || '{}') || {})
                : (g.config || {});
              
              return {
                id: String(g.id),
                title: g.title,
                code: g.code,
                description: g.description,
                starts_at: g.starts_at,
                ends_at: g.ends_at,
                created_by: g.created_by,
                created_at: g.created_at,
                config
              };
            });
            setEvents(mapped);
          } catch (e) {
            console.error('Create event error:', e);
            alert('Unable to create event');
          }
        }} />
      </div>

      {/* Events Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onToggleFeatured={() => toggleFeatured(event.id)}
            onCopyCode={() => copyCode(event.code)}
            onUpdate={async (updatedEvent) => {
              try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                const res = await fetch(`/api/moments/galleries/${updatedEvent.id}`, {
                  method: 'PATCH',
                  headers: { 
                    'Content-Type': 'application/json', 
                    ...(token ? { Authorization: `Bearer ${token}` } : {}) 
                  },
                  body: JSON.stringify({
                    title: updatedEvent.title,
                    code: updatedEvent.code,
                    description: updatedEvent.description,
                    starts_at: updatedEvent.starts_at,
                    ends_at: updatedEvent.config?.persistent ? null : updatedEvent.ends_at,
                    config: updatedEvent.config
                  })
                });
                
                if (!res.ok) throw new Error('Update failed');
                setEvents(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
              } catch (e) {
                console.error('Update event error:', e);
                alert('Unable to update event');
              }
            }}
          />
        ))}
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <div className="text-[#b2a491] mb-4">No moments events yet</div>
          <CreateEventButton onCreate={async () => {}} />
        </div>
      )}
    </div>
  );
}

function EventCard({ 
  event, 
  onToggleFeatured, 
  onCopyCode, 
  onUpdate 
}: { 
  event: MomentsEvent; 
  onToggleFeatured: () => void;
  onCopyCode: () => void;
  onUpdate: (event: MomentsEvent) => void;
}) {
  const isActive = event.starts_at && event.ends_at 
    ? new Date() >= new Date(event.starts_at) && new Date() <= new Date(event.ends_at)
    : true;
  
  const isPersistent = event.config?.persistent;
  const totalMedia = (event.photo_count || 0) + (event.video_count || 0);

  return (
    <article className="rounded-2xl overflow-hidden border border-[#3b3733] bg-[#1f1e1d]">
      {/* Header gradient */}
      <div className="h-24 bg-gradient-to-br from-[#502d26] to-[#6b4c3b] relative">
        {isActive && (
          <div className="absolute top-2 left-2">
            <div className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
              Live
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="text-[#ede8df] font-medium">{event.title}</div>
            <div className="text-xs text-[#b2a491] mt-0.5">
              Code: <span className="font-mono">{event.code}</span>
            </div>
            {event.description && (
              <div className="text-xs text-[#b2a491] mt-1 line-clamp-2">
                {event.description}
              </div>
            )}
          </div>
          <button
            onClick={onToggleFeatured}
            className={`px-2 py-1 text-xs rounded border flex-shrink-0 ${
              event.config?.featured 
                ? 'bg-[#ede8df] text-[#171616] border-transparent' 
                : 'bg-[#171616] text-[#ede8df] border-[#3b3733]'
            }`}
          >
            {event.config?.featured ? 'Featured' : 'Feature'}
          </button>
        </div>

        {/* Event timing */}
        <div className="text-xs text-[#b2a491] mb-3">
          {isPersistent ? (
            <>
              <span className="inline-block rounded px-1.5 py-0.5 bg-[#302927] text-[#ede8df] mr-2">
                Persistent
              </span>
              {event.starts_at ? formatDate(event.starts_at) : 'No start date'}
            </>
          ) : (
            <>
              {event.starts_at ? formatDate(event.starts_at) : 'No start'} 
              {event.ends_at ? ` → ${formatDate(event.ends_at)}` : ''}
            </>
          )}
        </div>

        {/* Media count */}
        {totalMedia > 0 && (
          <div className="text-xs text-[#b2a491] mb-3">
            📸 {event.photo_count || 0} photos, 🎥 {event.video_count || 0} videos
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={onCopyCode} 
            className="px-3 py-2 rounded bg-[#302927] text-[#ede8df] hover:bg-[#2a2626] text-sm"
          >
            Copy Code
          </button>
          <Link 
            href={`/moments/capture?galleryId=${event.id}`} 
            className="px-3 py-2 rounded bg-[#ede8df] text-[#171616] text-center text-sm hover:bg-[#d6cfc0]"
          >
            Open Capture
          </Link>
          <Link 
            href={`/moments/admin?galleryId=${event.id}`} 
            className="px-3 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] text-sm text-center hover:bg-[#2a2626]"
          >
            Moderate
          </Link>
          <EditEventButton 
            event={event} 
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </article>
  );
}

function CreateEventButton({ onCreate }: { onCreate: (event: MomentsEvent) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded bg-[#502d26] text-[#ede8df] hover:bg-[#6b4c3b]"
      >
        Create Event
      </button>
      {open && (
        <EventModal
          onClose={() => setOpen(false)}
          onSubmit={(event) => {
            setOpen(false);
            onCreate(event);
          }}
        />
      )}
    </>
  );
}

function EditEventButton({ 
  event, 
  onUpdate 
}: { 
  event: MomentsEvent; 
  onUpdate: (event: MomentsEvent) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 text-sm rounded bg-[#502d26] text-[#ede8df] hover:bg-[#6b4c3b]"
      >
        Edit
      </button>
      {open && (
        <EventModal
          initial={event}
          onClose={() => setOpen(false)}
          onSubmit={(updatedEvent) => {
            setOpen(false);
            onUpdate(updatedEvent);
          }}
        />
      )}
    </>
  );
}

function EventModal({ 
  initial, 
  onClose, 
  onSubmit 
}: { 
  initial?: MomentsEvent; 
  onClose: () => void; 
  onSubmit: (event: MomentsEvent) => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [code, setCode] = useState(initial?.code || generateCode());
  const [description, setDescription] = useState(initial?.description || '');
  const [uiStart, setUiStart] = useState<string>(
    initial?.starts_at ? initial.starts_at.slice(0, 10) : ''
  );
  const [uiEnd, setUiEnd] = useState<string>(
    initial?.ends_at ? initial.ends_at.slice(0, 10) : ''
  );
  const [persistent, setPersistent] = useState<boolean>(!!initial?.config?.persistent);
  const [featured, setFeatured] = useState(!!initial?.config?.featured);
  const [capacity, setCapacity] = useState(initial?.config?.capacity?.toString() || '');
  const [ticketPrice, setTicketPrice] = useState(initial?.config?.ticket_price?.toString() || '0');
  const [isPublic, setIsPublic] = useState(initial?.config?.is_public !== false);

  function generateCode(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function submit() {
    const id = initial?.id || `g${Math.random().toString(36).slice(2, 7)}`;
    const starts_at = uiStart ? new Date(`${uiStart}T00:00:00Z`).toISOString() : null;
    const ends_at = persistent ? null : (uiEnd ? new Date(`${uiEnd}T00:00:00Z`).toISOString() : null);
    
    const event: MomentsEvent = {
      id,
      title,
      code,
      description: description || null,
      starts_at,
      ends_at,
      config: {
        featured,
        persistent,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
        ticket_price: parseFloat(ticketPrice) || 0,
        is_public: isPublic
      }
    };
    
    onSubmit(event);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:w-[540px] rounded-t-2xl sm:rounded-2xl border border-[#3b3733] bg-[#1f1e1d] p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-[#ede8df] mb-4">
          {initial ? 'Edit Event' : 'Create Event'}
        </h3>
        
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <label className="block text-sm text-[#b2a491]">
            Event Title
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2" 
              placeholder="Studio Launch Night"
            />
          </label>
          
          <label className="block text-sm text-[#b2a491]">
            Event Code
            <div className="flex gap-2 mt-1">
              <input 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())} 
                className="flex-1 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2 font-mono" 
                placeholder="ABC123"
              />
              <button 
                onClick={() => setCode(generateCode())}
                className="px-3 py-2 rounded bg-[#302927] text-[#ede8df] hover:bg-[#2a2626] text-sm"
              >
                Generate
              </button>
            </div>
          </label>
          
          <label className="block text-sm text-[#b2a491]">
            Description (optional)
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2 h-20 resize-none" 
              placeholder="A night to remember..."
            />
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm text-[#b2a491]">
              Start Date
              <input 
                type="date" 
                value={uiStart} 
                onChange={(e) => setUiStart(e.target.value)} 
                className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2" 
              />
            </label>
            
            <label className="block text-sm text-[#b2a491]">
              End Date
              <input 
                type="date" 
                value={uiEnd} 
                onChange={(e) => setUiEnd(e.target.value)} 
                disabled={persistent}
                className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2 disabled:opacity-50" 
              />
            </label>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm text-[#b2a491]">
              Capacity (optional)
              <input 
                type="number" 
                value={capacity} 
                onChange={(e) => setCapacity(e.target.value)} 
                className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2" 
                placeholder="100"
              />
            </label>
            
            <label className="block text-sm text-[#b2a491]">
              Ticket Price
              <input 
                type="number" 
                step="0.01" 
                value={ticketPrice} 
                onChange={(e) => setTicketPrice(e.target.value)} 
                className="mt-1 w-full rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] p-2" 
              />
            </label>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-[#b2a491]">
              <input 
                type="checkbox" 
                checked={persistent} 
                onChange={(e) => setPersistent(e.target.checked)} 
                className="rounded border-[#3b3733]" 
              />
              Persistent Event (no end date)
            </label>
            
            <label className="flex items-center gap-2 text-sm text-[#b2a491]">
              <input 
                type="checkbox" 
                checked={featured} 
                onChange={(e) => setFeatured(e.target.checked)} 
                className="rounded border-[#3b3733]" 
              />
              Featured Event
            </label>
            
            <label className="flex items-center gap-2 text-sm text-[#b2a491]">
              <input 
                type="checkbox" 
                checked={isPublic} 
                onChange={(e) => setIsPublic(e.target.checked)} 
                className="rounded border-[#3b3733]" 
              />
              Public Event
            </label>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#3b3733]">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded bg-[#171616] text-[#ede8df] border border-[#3b3733] hover:bg-[#2a2626]"
          >
            Cancel
          </button>
          <button 
            onClick={submit} 
            disabled={!title.trim() || !code.trim()}
            className="px-4 py-2 rounded bg-[#502d26] text-[#ede8df] hover:bg-[#6b4c3b] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initial ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return iso.slice(0, 10);
  } catch {
    return String(iso);
  }
}