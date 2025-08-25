"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Video } from "../app/media/types";
import CloudflareStreamPlayer from "./CloudflareStreamPlayer";

interface VideoPlayerClientProps {
  video: Video;
  relatedVideos: Video[];
}

export default function VideoPlayerClient({ video, relatedVideos }: VideoPlayerClientProps) {
  const router = useRouter();
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const getStreamVideoId = (url: string): string | null => {
    try {
      const u = new URL(url);
      const hostname = u.hostname;
      if (!/videodelivery\.net$/.test(hostname) && !/cloudflarestream\.com$/.test(hostname) && !/iframe\.videodelivery\.net$/.test(hostname)) {
        return null;
      }
      // Extract first path segment as potential UID
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length === 0) return null;
      const candidate = segments[0];
      // Accept common UID patterns (32+ alphanumerics)
      if (/^[A-Za-z0-9_-]{24,}$/.test(candidate)) {
        return candidate;
      }
      return null;
    } catch {
      return null;
    }
  };

  const streamVideoId = getStreamVideoId(video.url);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-transparent text-white">
      {/* Header with Back Button */}
      <header className="flex-shrink-0 z-10 p-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-[#b2a491] hover:text-[#ede8df] transition-colors group glass-card p-2 rounded-xl"
          aria-label="Back to Media"
        >
          <svg className="w-5 h-5 group-hover:transform group-hover:-translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="font-medium text-sm">Back to Media</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="p-4 pt-0 pb-8 relative z-10">
        <div className="max-w-4xl mx-auto relative z-10">
          {/* Video Player: strict 16:9, frameless iframe filling container */}
          <div className="w-full aspect-video relative">
            <CloudflareStreamPlayer video={video} className="absolute inset-0" fillContainer={true} frameless={true} />
          </div>

          {/* Video Details */}
          <div className="py-6 relative z-20">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{video.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-300 mb-2">
              {video.type && <span className="capitalize">{video.type}</span>}
              {(video.type || video.category) && <span className="text-stone-500">•</span>}
              {video.category && <span className="capitalize">{video.category}</span>}
              {video.duration && <span className="text-stone-500">• {video.duration}</span>}
            </div>
            <p className="text-stone-400 text-sm line-clamp-2">
              {video.description || 'A short description will appear here. This is placeholder copy to keep the layout balanced while we wire up metadata.'}
            </p>
          </div>

          {/* Up Next Section (first related video) */}
          {relatedVideos.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-semibold text-white">Up Next</h2>
              </div>
              <Link href={`/media/${relatedVideos[0].id}`} className="block group">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="relative w-28 h-[63px] flex-shrink-0 bg-black/20 rounded overflow-hidden">
                    {relatedVideos[0].poster_url && (
                      <Image
                        src={relatedVideos[0].poster_url}
                        alt={relatedVideos[0].title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="112px"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white group-hover:text-red-400 transition-colors line-clamp-2 text-sm">
                      {relatedVideos[0].title}
                    </h3>
                    <p className="text-xs text-stone-400 capitalize">{relatedVideos[0].type}</p>
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
