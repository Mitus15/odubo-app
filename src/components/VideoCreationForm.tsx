"use client";

import { useState } from 'react';

interface VideoCreationFormProps {
  onVideoCreated?: () => void;
}

export default function VideoCreationForm({ onVideoCreated }: VideoCreationFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title, 
          description, 
          video_url: videoUrl, 
          poster_url: posterUrl, 
          duration 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create video');
      }

      alert('Video created successfully!');
      if (onVideoCreated) {
        onVideoCreated();
      }
    } catch (error) {
      console.error('Error creating video:', error);
      alert('Failed to create video. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-[#b2a491] text-sm font-medium mb-2">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c]"
          placeholder="Enter video title"
          required
        />
      </div>
      <div>
        <label className="block text-[#b2a491] text-sm font-medium mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c] resize-none"
          placeholder="Enter video description"
        />
      </div>
      <div>
        <label className="block text-[#b2a491] text-sm font-medium mb-2">Video URL</label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className="w-full px-4 py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c]"
          placeholder="Enter video URL"
          required
        />
      </div>
      <div>
        <label className="block text-[#b2a491] text-sm font-medium mb-2">Poster URL</label>
        <input
          type="text"
          value={posterUrl}
          onChange={(e) => setPosterUrl(e.target.value)}
          className="w-full px-4 py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c]"
          placeholder="Enter poster URL"
        />
      </div>
      <div>
        <label className="block text-[#b2a491] text-sm font-medium mb-2">Duration (seconds)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value))}
          className="w-full px-4 py-3 bg-[#302927]/60 border border-[#502d26]/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#843c2d] focus:border-transparent text-[#ede8df] placeholder-[#726d6c]"
          min="0"
        />
      </div>
      <button 
        type="submit" 
        disabled={loading} 
        className="w-full bg-[#843c2d] hover:bg-[#843c2d]/80 text-[#ede8df] font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create Video'}
      </button>
    </form>
  );
}