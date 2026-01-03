
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface Clip {
  id: number;
  title: string;
  uid: string;
  thumbnail: string;
  duration: string;
  created_at: string;
  artist_name?: string;
}

interface ClipsManagerProps {
  videoId: number;
  videoTitle: string;
  videoArtist: string;
}

export default function ClipsManager({ videoId, videoTitle, videoArtist }: ClipsManagerProps) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const dragFileIndex = useRef<number | null>(null);
  const dragClipIndex = useRef<number | null>(null);

  useEffect(() => {
    fetchClips();
  }, [videoId]);

  const fetchClips = async () => {
    try {
      const res = await fetch(`/api/videos/${videoId}/clips`);
      const data = await res.json() as { success: boolean; clips: Clip[] };
      if (data.success) {
        setClips(data.clips);
      }
    } catch (error) {
      console.error('Failed to fetch clips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...selectedFiles];
    if (direction === 'up' && index > 0) {
      [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
    } else if (direction === 'down' && index < newFiles.length - 1) {
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
    }
    setSelectedFiles(newFiles);
  };

  const reorderFiles = (from: number, to: number) => {
    if (from === null || to === null || from === to) return;
    const newFiles = [...selectedFiles];
    const [moved] = newFiles.splice(from, 1);
    newFiles.splice(to, 0, moved);
    setSelectedFiles(newFiles);
  };

  const moveClip = async (index: number, direction: 'up' | 'down') => {
    const newClips = [...clips];
    if (direction === 'up' && index > 0) {
      [newClips[index], newClips[index - 1]] = [newClips[index - 1], newClips[index]];
    } else if (direction === 'down' && index < newClips.length - 1) {
      [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
    } else {
      return;
    }
    setClips(newClips);

    // Save new order
    try {
      const payload = newClips.map((clip, idx) => ({ id: clip.id, position: idx }));
      await fetch(`/api/videos/${videoId}/clips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: payload })
      });
    } catch (error) {
      console.error('Failed to save order:', error);
    }
  };

  const reorderClips = async (from: number, to: number) => {
    if (from === null || to === null || from === to) return;
    const newClips = [...clips];
    const [moved] = newClips.splice(from, 1);
    newClips.splice(to, 0, moved);
    setClips(newClips);
    try {
      const payload = newClips.map((clip, idx) => ({ id: clip.id, position: idx }));
      await fetch(`/api/videos/${videoId}/clips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: payload })
      });
    } catch (error) {
      console.error('Failed to save order:', error);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadProgress('Starting upload...');

    try {
      // Determine starting clip number based on existing clips
      // Or just use 1-based index for this batch?
      // The user said: "The name of the clips ... should be the name of the video they are uploaded under along with their order number."
      // If we have existing clips, we should probably continue numbering or just use the batch order.
      // Let's use existing count + 1.
      let startNumber = clips.length + 1;

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const clipNumber = startNumber + i;
        // Use parent video title + number
        const clipTitle = `${videoTitle} ${clipNumber}`;
        
        setUploadProgress(`Uploading ${i + 1}/${selectedFiles.length}: ${clipTitle}`);

        // 1. Get Upload URL
        const urlRes = await fetch('/api/videos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: clipTitle })
        });
        const urlData = await urlRes.json() as { uploadURL?: string; uid?: string };
        
        if (!urlData.uploadURL) throw new Error('Failed to get upload URL');

        // 2. Upload to Cloudflare
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await fetch(urlData.uploadURL, {
          method: 'POST',
          body: formData
        });
        
        if (!uploadRes.ok) throw new Error('Upload to Cloudflare failed');
        
        // Wait a bit for processing? Or just assume we have the UID
        const uid = urlData.uid;
        
        // 3. Create Clip Record
        // We might not have thumbnail/duration yet, but Cloudflare will process it.
        // We can use a placeholder or wait.
        // For now, we send what we have.
        await fetch(`/api/videos/${videoId}/clips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid,
            title: clipTitle,
            artist_name: videoArtist,
            is_public: true,
            // Cloudflare takes time to generate thumbnail/duration.
            // We can rely on webhooks or just show "Processing" in UI.
          })
        });
      }

      setUploadProgress('Upload complete!');
      setSelectedFiles([]);
      fetchClips();
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadProgress('Upload failed. See console.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (clipId: number) => {
    if (!confirm('Are you sure you want to delete this clip?')) return;

    try {
      const res = await fetch(`/api/videos/${videoId}/clips`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId })
      });

      if (res.ok) {
        // Remove from local state
        setClips(clips.filter(c => c.id !== clipId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete clip');
      }
    } catch (error) {
      console.error('Delete clip error:', error);
      alert('Failed to delete clip');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1614] p-4 rounded border border-[#b2a491]/10">
        <h3 className="text-[#ede8df] font-medium mb-4">Existing Clips</h3>
        {loading ? (
          <div className="text-[#888]">Loading...</div>
        ) : clips.length === 0 ? (
          <div className="text-[#888]">No clips found.</div>
        ) : (
          <div className="space-y-3">
            {clips.map((clip, index) => (
              <div
                key={clip.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[#000]/20 p-3 rounded-lg gap-3"
                draggable
                onDragStart={() => { dragClipIndex.current = index; }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  const from = dragClipIndex.current;
                  dragClipIndex.current = null;
                  reorderClips(from as number, index);
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {clip.thumbnail && (
                    <div className="w-16 h-9 relative bg-black rounded shrink-0">
                      <Image src={clip.thumbnail} alt={clip.title} fill className="object-cover rounded" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[#ede8df] text-sm truncate">{clip.title}</div>
                    <div className="text-[#888] text-xs truncate">{clip.artist_name ? `${clip.artist_name} • ` : ''}{clip.uid}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 justify-end">
                  <div className="flex sm:flex-col gap-1">
                    <button
                      onClick={() => moveClip(index, 'up')}
                      disabled={index === 0}
                      className="text-[#888] hover:text-[#ede8df] disabled:opacity-30 text-base w-9 h-9 flex items-center justify-center bg-[#302927]/50 rounded-lg"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveClip(index, 'down')}
                      disabled={index === clips.length - 1}
                      className="text-[#888] hover:text-[#ede8df] disabled:opacity-30 text-base w-9 h-9 flex items-center justify-center bg-[#302927]/50 rounded-lg"
                      title="Move Down"
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(clip.id)}
                    className="text-red-400 hover:text-red-300 text-xs px-4 py-2.5 min-h-[44px] bg-red-600/10 rounded-lg"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#1a1614] p-4 rounded border border-[#b2a491]/10">
        <h3 className="text-[#ede8df] font-medium mb-4">Upload New Clips</h3>
        
        <input 
          type="file" 
          multiple 
          accept="video/*" 
          onChange={handleFileSelect}
          className="block w-full text-sm text-[#888] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#b2a491]/20 file:text-[#ede8df] hover:file:bg-[#b2a491]/30 mb-4"
        />

        {selectedFiles.length > 0 && (
          <div className="space-y-2 mb-4">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-[#000]/20 p-3 rounded-lg gap-2"
                draggable
                onDragStart={() => { dragFileIndex.current = index; }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  const from = dragFileIndex.current;
                  dragFileIndex.current = null;
                  reorderFiles(from as number, index);
                }}
              >
                <span className="text-[#ede8df] text-sm truncate flex-1">{file.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveFile(index, 'up')} disabled={index === 0} className="text-[#888] hover:text-[#ede8df] disabled:opacity-30 w-9 h-9 flex items-center justify-center bg-[#302927]/50 rounded-lg text-base">↑</button>
                  <button onClick={() => moveFile(index, 'down')} disabled={index === selectedFiles.length - 1} className="text-[#888] hover:text-[#ede8df] disabled:opacity-30 w-9 h-9 flex items-center justify-center bg-[#302927]/50 rounded-lg text-base">↓</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="text-[#b2a491] text-sm mb-4">{uploadProgress}</div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0}
          className="w-full sm:w-auto bg-[#b2a491] text-[#1a1614] px-6 py-3 min-h-[48px] rounded-lg font-medium disabled:opacity-50 hover:bg-[#c5b8a5] transition-colors text-sm"
        >
          {uploading ? 'Uploading...' : 'Upload Clips'}
        </button>
      </div>
    </div>
  );
}
