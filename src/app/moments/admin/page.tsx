import { useEffect, useState } from 'react';
import Moderation from './moderation';

export default function MomentsAdminPage({ searchParams }: { searchParams?: { galleryId?: string } }) {
  const [galleries, setGalleries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [galleryId, setGalleryId] = useState(searchParams?.galleryId || '');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/moments/list?limit=20');
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error(data?.error || 'Failed');
        setGalleries(data.photos || []);
        if (!galleryId && data.photos && data.photos.length > 0) setGalleryId(String(data.photos[0].gallery_id || data.photos[0].galleryId || ''));
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Moments Admin</h1>
      {loading && <div>Loading...</div>}
      {!loading && (
        <div>
          <div className="mb-4">
            <label className="block text-sm">Gallery ID</label>
            <input value={galleryId} onChange={(e) => setGalleryId(e.target.value)} className="mt-1 px-3 py-2 rounded bg-[#171616] text-[#ede8df]" />
          </div>

          <div className="mb-6">
            <Moderation galleryId={galleryId} />
          </div>
        </div>
      )}
    </div>
  );
}
